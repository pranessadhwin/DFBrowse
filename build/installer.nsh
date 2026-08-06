; DFBrowse — custom NSIS install/uninstall hooks.
;
; Registers DFBrowse with Windows as a web browser so it appears in
; Settings → Apps → Default apps → Web browser (exactly like Chrome/Brave),
; and so links can be opened with DFBrowseURL.

!macro customInstall
  ; ── Per-user browser registration (StartMenuInternet capabilities) ──────
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse" "" "DFBrowse"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities" "ApplicationName" "DFBrowse"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities" "ApplicationDescription" "DFBrowse — a focused study browser with a strict allowlist."
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities" "ApplicationIcon" "$INSTDIR\DFBrowse.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities\StartMenuInternet" "" "DFBrowse"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities\URLAssociations" "http" "DFBrowseURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities\URLAssociations" "https" "DFBrowseURL"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities\FileAssociations" ".htm" "DFBrowseHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\Capabilities\FileAssociations" ".html" "DFBrowseHTML"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\DefaultIcon" "" "$INSTDIR\DFBrowse.exe,0"
  WriteRegStr HKCU "Software\Clients\StartMenuInternet\DFBrowse\shell\open\command" "" "$\"$INSTDIR\DFBrowse.exe$\" -- $\"%1$\""

  ; ── ProgIDs used when DFBrowse is chosen as the browser ─────────────────
  WriteRegStr HKCU "Software\Classes\DFBrowseURL" "" "DFBrowse URL"
  WriteRegStr HKCU "Software\Classes\DFBrowseURL\DefaultIcon" "" "$INSTDIR\DFBrowse.exe,0"
  WriteRegStr HKCU "Software\Classes\DFBrowseURL\shell\open\command" "" "$\"$INSTDIR\DFBrowse.exe$\" -- $\"%1$\""
  WriteRegStr HKCU "Software\Classes\DFBrowseHTML" "" "DFBrowse HTML Document"
  WriteRegStr HKCU "Software\Classes\DFBrowseHTML\DefaultIcon" "" "$INSTDIR\DFBrowse.exe,0"
  WriteRegStr HKCU "Software\Classes\DFBrowseHTML\shell\open\command" "" "$\"$INSTDIR\DFBrowse.exe$\" -- $\"%1$\""

  ; ── Advertise to the OS default-apps system ─────────────────────────────
  WriteRegStr HKCU "Software\RegisteredApplications" "DFBrowse" "Software\Clients\StartMenuInternet\DFBrowse\Capabilities"
!macroend

!macro customUnInstall
  DeleteRegKey HKCU "Software\Clients\StartMenuInternet\DFBrowse"
  DeleteRegValue HKCU "Software\RegisteredApplications" "DFBrowse"
  DeleteRegKey HKCU "Software\Classes\DFBrowseURL"
  DeleteRegKey HKCU "Software\Classes\DFBrowseHTML"
!macroend
