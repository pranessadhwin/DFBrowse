'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyBrowser', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  canNavigate: url => ipcRenderer.invoke('policy:canNavigate', url),
  setPassword: password => ipcRenderer.invoke('auth:setPassword', password),
  changePassword: (token, oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', token, oldPassword, newPassword),
  unlock: password => ipcRenderer.invoke('auth:unlock', password),
  lock: token => ipcRenderer.invoke('auth:lock', token),
  addSite: (token, site) => ipcRenderer.invoke('sites:add', token, site),
  removeSite: (token, site) => ipcRenderer.invoke('sites:remove', token, site),
  setHome: (token, site) => ipcRenderer.invoke('sites:setHome', token, site),
  getStudyPartition: () => ipcRenderer.invoke('app:studyPartition'),
  // Stored sign-in identities (Google emails). Only the email address is
  // recorded; Google sign-in itself always happens in the real browser.
  addAccount: email => ipcRenderer.invoke('accounts:add', email),
  removeAccount: id => ipcRenderer.invoke('accounts:remove', id),
  markAccountUsed: id => ipcRenderer.invoke('accounts:markUsed', id),
  openAccountSignIn: (email, sourceUrl) => ipcRenderer.invoke('accounts:openSignIn', email, sourceUrl),
  // Google rejects OAuth from embedded webviews. Open only validated Google
  // sign-in URLs in the user's real browser.
  openGoogleAuthExternally: (authUrl, sourceUrl) =>
    ipcRenderer.invoke('app:openGoogleAuthExternally', authUrl, sourceUrl),
  onGoogleAuthExternalized: callback => {
    ipcRenderer.on('app:googleAuthExternalized', (event, payload) => callback(payload));
  },
  // External URLs (clicked links while DFBrowse is the default browser).
  onOpenUrl: callback => {
    ipcRenderer.on('app:openUrl', (event, url) => callback(url));
  },
  // Windows default-browser support.
  isDefaultBrowser: () => ipcRenderer.invoke('app:isDefaultBrowser'),
  setDefaultBrowser: () => ipcRenderer.invoke('app:setDefaultBrowser')
});
