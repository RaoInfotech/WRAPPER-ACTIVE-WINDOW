const fs = require("fs");
const path = require("path");
const Database = require('better-sqlite3');
const os = require("os");
const ShellApplicationRuns = require("./run_iexplorer");
const stringFilter = require("./string_filteration");
const { parse } = require("ini");
const { extractDomain, checkOsConfiguration } = require("./utils");
const shellApplicationRuns = new ShellApplicationRuns();
class ExtractUrlHistory {
    userDataPath;
    localStatePath;
    createdTemPath = [];
    constructor() { }

    readHistory(tempPath, query) { // this will read history from browsers db files...
        return new Promise((resolve) => {
            try {
                if (!tempPath || !fs.existsSync(tempPath)) {
                    console.error('History DB not found:', tempPath);
                    return resolve([]);
                }

                const db = new Database(tempPath, { readonly: true });

                const stmt = db.prepare(query);
                const rows = stmt.all(); // synchronous
                db.close();

                resolve(rows);
            } catch (err) {
                console.error('Error reading history:', err);
                resolve([]);
            }
        });
    }


    matchActiveTitleToHistory(history, currentApp, profile) {
        let historyMatches = [];
        for (const h of history) {
            if (h.title && h.url) {
                const stringResult = stringFilter.compareStrings(currentApp.title.trim(), h.title || "", h.url);
                if (stringResult.isMatch) {
                    historyMatches.push(stringResult);
                }
            }
        }

        if (historyMatches.length > 0) {
            let foundedApp = currentApp;
            foundedApp['historyMatches'] = stringFilter.pickBestRecord(historyMatches);
            foundedApp['profile'] = profile;
            if (foundedApp['historyMatches'] && (foundedApp['historyMatches'].url && foundedApp['historyMatches'].url != "")) {
                let url = extractDomain(foundedApp['historyMatches'].url);
                foundedApp['url'] = url;
                foundedApp['isBrowser'] = true;
            }
            return foundedApp;
        } else {
            return null;
        }
    }

    createPaths = async (currentApp, browserInformation) => {
        try {
            const isGlobalHistoryAvailable = path.join(this.userDataPath, browserInformation['platforms']['win32']['historyFile']);

            // Here is the function for getting global history
            const getGlobalHistory = async () => {
                const randomSixDigit = Math.floor(100000 + Math.random() * 900000);
                let tempPath = path.join(os.tmpdir(), `${randomSixDigit}.db`);
                fs.copyFileSync(isGlobalHistoryAvailable, tempPath);
                let history = await this.readHistory(tempPath, browserInformation.sqlQuery);
                let result;
                if (history.length === 0) {
                    console.log("⚠️ No history found.");
                } else {
                    result = await this.matchActiveTitleToHistory(history, currentApp, tempPath);
                }
                if (result) {
                    return result;
                } else {
                    return null;
                }
            }

            if (fs.existsSync(this.localStatePath)) {
                let lastActive = [];
                let lastUsedProfile = "";
                let results = [];

                if (browserInformation['platforms']['win32']['historyType'] == 'ini') {
                    let text = fs.readFileSync(this.localStatePath, {
                        encoding: 'utf-8'
                    })
                    const raw = parse(text);
                    let profilesInUse = [];
                    for (const key of Object.keys(raw)) {
                        if (raw[key].Path) {
                            profilesInUse.push(raw[key].Path);
                        }
                    }
                    lastActive = profilesInUse;
                    lastUsedProfile = raw['Profile0'].Path;
                } else {
                    let raw = fs.readFileSync(this.localStatePath, browserInformation['platforms']['win32']['historyType']);
                    let localState = JSON.parse(raw);
                    lastActive = localState?.profile?.last_active_profiles;
                    lastUsedProfile = localState?.profile?.last_used;
                }
                if (Array.isArray(lastActive) && lastActive.length > 0) {
                    const tempPathBackupDB = async () => {
                        let tempPaths = [];
                        let checkIsTakeDbBackUp = browserInformation['platforms']['win32']['historyFile'].toLowerCase().includes('.sqlite') ? true : false;
                        for (let i = 0; i < lastActive.length; i++) {
                            const profile = lastActive[i];
                            const tempPath = path.join(os.tmpdir(), `${profile}.db`);
                            const filePaths = this.findMatchingFiles(
                                path.join(this.userDataPath, profile),
                                browserInformation['platforms']['win32']['historyFile']
                            );
                            if (filePaths.length === 0) continue;
                            const localStatePath = filePaths[0];
                            if (!fs.existsSync(localStatePath)) continue;
                            fs.mkdirSync(path.dirname(tempPath), { recursive: true });

                            if (checkIsTakeDbBackUp) {
                                try {
                                    const sourceDB = new Database(localStatePath, {
                                        readonly: true,
                                        fileMustExist: true
                                    });
                                    await sourceDB.backup(tempPath);
                                    sourceDB.close();
                                    tempPaths.push({ tempPath, profile });
                                    console.log("Backup completed safely");
                                } catch (err) {
                                    console.error("Backup failed:", err);
                                }
                            } else {
                                fs.copyFileSync(localStatePath, tempPath);
                                tempPaths.push({ tempPath, profile });
                            }
                        }

                        return tempPaths;
                    };
                    let tempPaths = await tempPathBackupDB();
                    this.createdTemPath = tempPaths.map(tp => tp.tempPath);
                    for (let i = 0; i < tempPaths.length;) {
                        if (tempPaths[i].tempPath) {
                            console.log("Temp Paths", tempPaths[i].tempPath)
                            let history = await this.readHistory(tempPaths[i].tempPath, browserInformation.sqlQuery);
                            // console.log(history)
                            if (history.length === 0) {
                                console.log("No history");
                                i++;
                            } else {
                                const result = await this.matchActiveTitleToHistory(history, currentApp, tempPaths[i].profile);
                                results.push(result);
                                i++;
                            }
                        } else {
                            i++;
                        }
                    }

                    results = results.filter((value) => value);

                    if (results.length > 1) {
                        let defaultProfile = results.filter((result) => result.profile == lastUsedProfile);
                        if (defaultProfile.length > 0) {
                            return defaultProfile[0];
                        } else {
                            return results[0];
                        }
                    } else if (results.length > 0) {
                        return results[0]
                    } else {
                        return null;
                    }


                } else if (fs.existsSync(isGlobalHistoryAvailable)) {
                    return getGlobalHistory();
                } else {
                    return null;
                }
            } else if (fs.existsSync(isGlobalHistoryAvailable)) {
                return getGlobalHistory();
            } else {
                return null;
            }
        } catch (err) {
            console.log("Error while getting local state:", err);
            return null;
        }
    }

    createPathsForLinux = async (currentProvidedApp, browserInformation) => {
        try {
            let fileLocations = this.findFilesInDir(this.userDataPath, browserInformation['platforms']["linux"]["historyFile"]);
            let results = [];
            if (Array.isArray(fileLocations) && fileLocations.length > 0) {

                const tempPaths = fileLocations.map((pathsLocation) => {
                    let randomName = Math.floor(Math.random() * 9000000000) + 1000000000;
                    const tempPath = path.join(os.tmpdir(), `${randomName}.db`);
                    fs.copyFileSync(pathsLocation, tempPath);
                    return { tempPath };
                })
                this.createdTemPath = tempPaths.map(tp => tp.tempPath);
                for (let i = 0; i < tempPaths.length;) {
                    let history = await this.readHistory(tempPaths[i].tempPath);
                    if (history.length === 0) {
                        console.log("⚠️ No history found.", tempPaths[i].tempPath);
                        i++;
                    } else {
                        const result = await this.matchActiveTitleToHistory(history, currentProvidedApp, tempPaths[i].profile);
                        results.push(result);
                        i++;
                    }
                }
                results = results.filter((value) => value);
                if (results.length > 0) {
                    return results[0]
                } else {
                    return null;
                }
            } else {
                return null;
            }
        } catch (err) {
            console.log("Error while getting local state:", err);
            return null;
        }
    }

    findFilesInDir(startPath, targetFile, depth = 0) {
        if (depth === 4) {
            return [];
        }
        let results = [];
        if (!fs.existsSync(startPath)) {
            return results;
        }
        let files = fs.readdirSync(startPath);
        for (let i = 0; i < files.length; i++) {
            let filename = path.join(startPath, files[i]);
            if (!fs.existsSync(filename)) {
                continue;
            }
            let stat = fs.lstatSync(filename);
            if (stat.isDirectory()) {
                results = results.concat(this.findFilesInDir(filename, targetFile, depth + 1)); //recurse
            } else if (filename.endsWith(targetFile) === true) {
                // console.log('-- found: ', filename);
                results.push(filename);
            }
        }
        return results;
    }

    async findUrlFromShellApp(activeWin, browserInformation) {
        console.log("\n\nBrowsr info", browserInformation);
        let browserHistoryIE = await shellApplicationRuns.getInformationFromShellApp();
        console.log("\n\nHistory of Internet explorer", browserHistoryIE);
        if (browserHistoryIE && browserHistoryIE.length > 0) {
            let currentTab = this.matchActiveTitleToHistory(browserHistoryIE, activeWin, null);
            if (currentTab) {
                return currentTab;
            } else {
                return null;
            }
        }
    }

    windowReport(activeWindow, browserInformation) {
        return new Promise(async (resolve, reject) => {
            try {
                const currentApplication = activeWindow;
     
                if (currentApplication?.owner.path) {
                    if (!browserInformation) {
                        return resolve(activeWindow);
                    }
                    let findApplication;
                    const appDataDirectory = this.getAppDataDirectory();
                    const os_info = checkOsConfiguration();
                    if (os_info == "Linux") {
                        let userDataPathBrowserInformation = browserInformation['platforms']['linux']['userDataPath'];
                        this.userDataPath = path.join(appDataDirectory, ".config", userDataPathBrowserInformation);
                        let snapPathBrowserInformation = browserInformation['platforms']['linux']['snapPath'];
                        let browserPath;
                        if (fs.existsSync(this.userDataPath)) {
                            browserPath = this.userDataPath;
                        } else if (snapPathBrowserInformation && fs.existsSync(path.join(appDataDirectory, snapPathBrowserInformation))) {
                            browserPath = snapPathBrowserInformation;
                            this.userDataPath = path.join(appDataDirectory, snapPathBrowserInformation)
                        }
                        this.localStatePath = path.join(this.userDataPath, browserInformation['platforms']['win32']["localStateFile"]);
                        findApplication = await this.createPaths(currentApplication, browserInformation);
                    } else {
                        if (!browserInformation['isShellRun']) {
                            let userDataPath = "";
                            switch (os_info) {
                                case "win_7":
                                    userDataPath = browserInformation['platforms']['win32']["userDataPathWin7"] ? "userDataPathWin7" : "userDataPath";
                                    break;
                                case "win_8":
                                    userDataPath = browserInformation['platforms']['win32']["userDataPathWin8Plus"] ? "userDataPathWin8Plus" : "userDataPath";
                                    break;
                                case "win_10":
                                    userDataPath = "userDataPath";
                                    break;
                                case "win_11":
                                    userDataPath = "userDataPath";
                                    break;
                            }
                            let browserPath = browserInformation['platforms']['win32'][userDataPath];
                            this.userDataPath = path.join(appDataDirectory, browserPath);
                            this.localStatePath = path.join(this.userDataPath, browserInformation['platforms']['win32']["localStateFile"]);
                            findApplication = await this.createPaths(currentApplication, browserInformation);
                        }
                    }

                    if (browserInformation['isShellRun']) {
                        return resolve(this.findUrlFromShellApp(activeWindow, browserInformation));
                    }

                    if (this.createdTemPath.length > 0) {
                        for (let path = 0; path < this.createdTemPath.length; path++) {
                            if (fs.existsSync(this.createdTemPath[path])) {
                                console.log("Removing temp file".red, this.createdTemPath[path]);
                                fs.unlinkSync(this.createdTemPath[path]);
                            }
                        }
                    }
                    this.createdTemPath = [];

                    if (findApplication) {
                        return resolve(findApplication);
                    } else {
                        return resolve(activeWindow);
                    }
                }
            }
            catch (error) {
                console.log("Error while get the window report", error);
                return activeWindow;
            }
        })
    }

    getAppDataDirectory() {
        const home = os.homedir();

        if (process.platform === "win32") {
            return path.join(home, "AppData");
        }

        if (process.platform === "darwin") {
            return path.join(home, "Library", "Application Support");
        }

        // Linux
        return process.env.XDG_CONFIG_HOME || path.join(home);
    }


    findMatchingFiles(dirPath, baseFileName) {
        if (!fs.existsSync(dirPath)) return [];

        const files = fs.readdirSync(dirPath);

        const matchedFiles = files.filter(file =>
            file === baseFileName || file.startsWith(baseFileName + ".")
        );

        // return full paths (recommended)
        return matchedFiles.map(file => path.join(dirPath, file));
    }
}

module.exports = ExtractUrlHistory;
