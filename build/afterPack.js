'use strict';

// afterPack hook: embeds the DFBrowse icon and version info into the Windows
// executable when the build runs on a non-Windows machine (where electron-
// builder's rcedit step is skipped). On native Windows builds rcedit already
// handled this, so we skip.
//
// Uses "resedit" (pure JavaScript, no wine required).

const fs = require('fs');
const path = require('path');

exports.default = async function afterPack(context) {
  if (process.platform === 'win32') return;
  if (context.electronPlatformName !== 'win32') return;

  let resedit;
  try {
    resedit = require('resedit');
  } catch {
    // resedit not installed — nothing we can patch with.
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const exePath = path.join(context.appOutDir, `${productFilename}.exe`);
  const iconPath = path.join(context.packager.info.buildResourcesDir, 'icon.ico');

  if (!fs.existsSync(exePath) || !fs.existsSync(iconPath)) return;

  const { NtExecutable, NtExecutableResource, Resource } = resedit;

  const exeData = fs.readFileSync(exePath);
  const exe = NtExecutable.from(exeData);
  const res = NtExecutableResource.from(exe);

  // Replace the embedded icon (group id 1 / 101 is the main app icon).
  try {
    const iconFile = Resource.IconFile.from(fs.readFileSync(iconPath));
    const iconGroup = Resource.IconGroupEntry.fromIconFile(iconFile);
    Resource.IconGroupEntry.replaceIconsForResource(res.entries, 1, 101, iconGroup.icons);
    Resource.IconGroupEntry.replaceIconGroupResource(res.entries, 1, 101, iconGroup);
  } catch (error) {
    console.warn('[afterPack] icon patch skipped:', error.message);
  }

  // Update version metadata so Windows shows DFBrowse details.
  try {
    const version = context.packager.appInfo.version;
    res.entries.forEach(entry => {
      if (entry.type === Resource.ResourceType.VERSION) {
        const vi = Resource.VersionInfo.fromEntries(res.entries, entry.lang);
        const strings = vi.getStringEntries();
        if (strings.length) {
          vi.setStringValues(strings, {
            FileDescription: 'DFBrowse',
            ProductName: 'DFBrowse',
            CompanyName: 'DFBrowse',
            LegalCopyright: context.packager.appInfo.copyright || 'DFBrowse',
            FileVersion: version,
            ProductVersion: version
          });
          vi.outputToResourceEntries(res.entries, entry.lang);
        }
      }
    });
  } catch (error) {
    console.warn('[afterPack] version patch skipped:', error.message);
  }

  res.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`[afterPack] patched icon/version into ${exePath}`);
};
