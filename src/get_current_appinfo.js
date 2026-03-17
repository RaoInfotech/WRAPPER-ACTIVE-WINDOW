const ExtractUrlHistory = require("./extract_url_history");
const { checkApplicationBrowser } = require("./utils");

class GetCurrentApplicationInfo {
    static extractUrlHistoryInstance;
    constructor() {
        this.extractUrlHistoryInstance = new ExtractUrlHistory();
    }

    getCurrentApplicationInfo(active_win, browserConfigFromFile) {
        return new Promise(async (resolve, reject) => {
            const currentApplication = active_win;
            if (currentApplication?.owner.path) {
                let getBrowserInformation = checkApplicationBrowser(active_win.owner.name, browserConfigFromFile);
                return resolve(await this.extractUrlHistoryInstance.windowReport(active_win, getBrowserInformation));
            } else {
                return resolve(active_win);
            }
        });
    }
}

module.exports = GetCurrentApplicationInfo;
