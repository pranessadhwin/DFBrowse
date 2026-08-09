'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('studyBrowser', {
  getConfig: () => ipcRenderer.invoke('config:get'),
  setPassword: password => ipcRenderer.invoke('auth:setPassword', password),
  changePassword: (token, oldPassword, newPassword) =>
    ipcRenderer.invoke('auth:changePassword', token, oldPassword, newPassword),
  unlock: password => ipcRenderer.invoke('auth:unlock', password),
  lock: token => ipcRenderer.invoke('auth:lock', token),
  addSite: (token, site) => ipcRenderer.invoke('sites:add', token, site),
  removeSite: (token, site) => ipcRenderer.invoke('sites:remove', token, site),
  setHome: (token, site) => ipcRenderer.invoke('sites:setHome', token, site),
  // BrowserView navigation is owned by the main process; the renderer only
  // sends commands and receives state updates.
  navigate: url => ipcRenderer.invoke('browser:navigate', url),
  goHome: () => ipcRenderer.invoke('browser:goHome'),
  goBack: () => ipcRenderer.invoke('browser:goBack'),
  goForward: () => ipcRenderer.invoke('browser:goForward'),
  reload: () => ipcRenderer.invoke('browser:reload'),
  setViewState: state => ipcRenderer.send('browser:setViewState', state),
  onUrlChanged: callback => {
    ipcRenderer.on('browser:url-changed', (event, payload) => callback(payload));
  },
  onLoading: callback => {
    ipcRenderer.on('browser:loading', (event, payload) => callback(payload));
  },
  onBlocked: callback => {
    ipcRenderer.on('browser:blocked', (event, payload) => callback(payload));
  },
  // External URLs (clicked links while DFBrowse is the default browser).
  onOpenUrl: callback => {
    ipcRenderer.on('app:openUrl', (event, url) => callback(url));
  },
  // Windows default-browser support.
  isDefaultBrowser: () => ipcRenderer.invoke('app:isDefaultBrowser'),
  setDefaultBrowser: () => ipcRenderer.invoke('app:setDefaultBrowser')
});
