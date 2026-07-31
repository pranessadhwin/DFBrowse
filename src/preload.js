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
  getStudyPartition: () => ipcRenderer.invoke('app:studyPartition')
});
