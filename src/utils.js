const os = require("os");

function extractDomain(url) {
    switch (url) {
        case /^file:\/\//i.test(url):
            const path = url.replace(/^file:\/\//i, '').replace(/^\/+/, '');
            console.log("---------------- FILE URL FROM HISTORY DETECTS ---------------- ", this.buildFileRoot(path))
            return buildFileRoot(path);
        case /^[a-zA-Z]:[\\/]/.test(url):
            console.log("---------------- LOCAL PATH FROM HISTORY DETECTS ---------------- ", this.buildFileRoot(url))
            return buildFileRoot(url);
        default:
            const urlObj = new URL(url);
            console.log("---------------- RETURNS URL FROM HISTORY MATCHES ---------------- ", urlObj.origin)
            return urlObj.origin;
    }
}

function buildFileRoot(path) {
    if (!path) return null;

    const normalized = path.replace(/\\/g, '/');

    // ✅ CASE 1: Drive root only (C:/)
    const driveOnly = normalized.match(/^([a-zA-Z]:)\/?$/);
    if (driveOnly) {
        return `file://${driveOnly[1]}/`;
    }

    // ✅ CASE 2: Drive + first folder (C:/Users/...)
    const match = normalized.match(/^([a-zA-Z]:)\/([^/]+)/);
    if (!match) return null;

    const drive = match[1];
    const firstFolder = match[2];

    return `file://${drive}/${firstFolder}/`;
}

function checkApplicationBrowser(applicationName, browserData) {
    if (!applicationName) return null;
    const app = applicationName.toLowerCase();

    return browserData.browsers.find(
        browser => browser.enabled && browser.detection?.patterns?.some(pattern => app.includes(pattern.toLowerCase())
        )) || null;
}

function checkOsConfiguration() {
    const os_type = os.type();
    if (os_type == "Windows_NT") {
        const release = os.release(); // "10.0.22631"
        const [major, minor, build] = release.split('.').map(Number);
        if (major === 6 && minor === 1) return 'win_7';
        if (major === 6 && minor === 2) return 'win_8';
        if (major === 6 && minor === 3) return 'win_8';
        if (major === 10) {
            if (build >= 22000) {
                return 'win_11';
            }
            return 'win_10';
        }
    }
    return os_type;
}


module.exports = { extractDomain, buildFileRoot, checkApplicationBrowser, checkOsConfiguration }
