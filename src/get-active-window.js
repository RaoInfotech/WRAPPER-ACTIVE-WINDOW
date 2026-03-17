const activeWin = require("active-win");
const SetupBrowserJSONData = require("./setup_browser_json");
const GetCurrentApplicationInfo = require("./get_current_appinfo");
const { checkApplicationBrowser, checkOsConfiguration } = require("./utils");
const activeWinExe = require("./get-url-from-exe");
const colors = require("colors");
const log = console.log;

class GetActiveWindow {
    folderName = "";
    constructor(folderName) {
        this.folderName = folderName;
    }

    getDataFromHistory() {
        return new Promise(async (res, rej) => {
            const extract_url_history = new GetCurrentApplicationInfo();
            const active_win = this.getActiveWin();
            const browserInformationJSON = new SetupBrowserJSONData().getFileData(this.folderName);
            if (browserInformationJSON) {
                if (active_win) {
                    let result = await extract_url_history.getCurrentApplicationInfo(active_win, browserInformationJSON);
                    if (result) {
                        res(result);
                    } else {
                        res(active_win);
                    }
                }
            } else {
                res(active_win);
            }
        })
    }

    getDataFromNetTool(active_win) {
        return new Promise(async (resolve, reject) => {
            if (active_win.owner && active_win.owner.path) {
                if (active_win.owner.processId) {
                    const result_from_tool = await activeWinExe(active_win.owner.processId);
                    if (result_from_tool) {
                        active_win['url'] = result_from_tool;
                        active_win['isBrowser'] = true;
                        log(" -- Native exe gets url -- ".cyan, result_from_tool);
                        resolve(active_win);
                    } else {
                        resolve(this.getDataFromHistory());
                    }
                } else {
                    resolve(this.getDataFromHistory());
                }
            } else {
                resolve(active_win);
            }
        })
    }

    getWindowsInfo(win_type) {
        let browserData = new SetupBrowserJSONData().getFileData(this.folderName);
        let active_win = this.getActiveWin();
        if (!active_win) { return null }
        // Checking if browser data is available or not
        if (browserData && browserData['browsers']) {
            const is_browser = checkApplicationBrowser(active_win?.owner.name, browserData); // application is browser or not
            if (!is_browser) {
                return active_win
            };
        } else {
            return active_win;
        }

        switch (win_type) {
            case "win_7":
                log("System is windows 7 we use history".yellow);
                return this.getDataFromHistory();
                break;
            case "win_8":
                log("System is windows 8 we use history".yellow);
                return this.getDataFromHistory();
                break;
            case "win_11":
                log("System is windows 11 we use native exe".yellow);
                return this.getDataFromNetTool(active_win);
                break;
            case "win_10":
                log("System is windows 10 we use native exe".yellow);
                return this.getDataFromNetTool(active_win);
                break;
        }
    }

    getLinuxInfo() {
        return this.getDataFromHistory();
    }

    getDarwinInfo() {
        return this.getActiveWin();
    }

    getActiveWin() {
        const active_win = activeWin.sync();
        if (!active_win) return null;
        return active_win;
    }


    async getCurrentActiveWindow() {

        return new Promise((resolve, rejects)=>{
            const os_info = checkOsConfiguration();
            switch (os_info) {
                case "Linux":
                    return resolve(this.getLinuxInfo()) .catch((error)=>{
                        return rejects(error)
                    });
                    break;
                case "Darwin":
                    return resolve(this.getDarwinInfo()) .catch((error)=>{
                        return rejects(error)
                    });
                    break;
                default:
                    return resolve(this.getWindowsInfo(os_info)) .catch((error)=>{
                        return rejects(error)
                    });
                    break;
            }
        })

    }
}

module.exports = GetActiveWindow;
