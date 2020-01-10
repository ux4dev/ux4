
const font = {
    bold_on: "\x1b[1m",
    /** @attribute {String} bold_on Bold text */
    reset: "\x1b[0m",
    /** @attribute {String} reset Reset log formatting */
    inverse_on: "\x1b[7m",
    /** @attribute {String} inverse_on Invert text */
    bold_off: "\x1b[22m",
    /** @attribute {String} bold_off Normal text */
    fg_black: "\x1b[30m",
    /** @attribute {String} fg_black Black text colour */
    fg_red: "\x1b[31m",
    /** @attribute {String} fg_red Red text color*/
    fg_green: "\x1b[32m",
    /** @attribute {String} fg_green Green text color */
    fg_yellow: "\x1b[33m",
    /** @attribute {String} fg_yellow Yellow text color */
    fg_blue: "\x1b[34m",
    /** @attribute {String} fg_blue Blue text color */
    fg_magenta: "\x1b[35m",
    /** @attribute {String} fg_magenta Magneta text color */
    fg_cyan: "\x1b[36m",
    /** @attribute {String} fg_cyan Red text color */
    fg_white: "\x1b[37m",
    /** @attribute {String} fg_white White text color */
    bg_red: "\x1b[41m",
    /** @attribute {String} bg_red Red background color */
    bg_green: "\x1b[42m",
    /** @attribute {String} bg_green Green background color  */
    bg_yellow: "\x1b[43m",
    /** @attribute {String} bg_yellow Yellow background color  */
    bg_blue: "\x1b[44m",
    /** @attribute {String} bg_blue Blue background color */
    bg_magenta: "\x1b[45m",
    /** @attribute {String} bg_magenta Magenta  background color*/
    bg_cyan: "\x1b[46m",
    /** @attribute {String} bg_cyan Cyan background color*/
    bg_white: "\x1b[47m",
    /** @attribute {String} bg_white White background color */
    moveback1char: "\033[1D",
    /** @attribute {String} moveback1char Move cursor back one character*/
    moveback1line: "\033[1A",
    /** @attribute {String} moveback1char Move cursor up one line*/
    cls: "\033c" /** @attribute {String} clear terminal*/
};


const semverReg = /^(\d+)\.(\d+)\.(\d+)$/;

function success(msg) {
    return console.log(font.fg_green + msg + font.reset);
}

function logError(error) {
    console.log(font.fg_red + "ERROR: " + (error || "") + font.reset);
}

function fatalError(error) {
    if (error) logError(error);
    process.exit(1);
}


function resolveVersionNumber(version, _versions) {

    const versions = (_versions || []).map(function (a) {
        const parts = a.split(".");
        return { name: a, major: Number(parts[0]), minor: Number(parts[1]), patch: Number(parts[2]) };
    }).sort(function (a, b) {
        return a.major === b.major ? (a.minor === b.minor ? (a.patch === b.patch ? 0 : b.patch - a.patch) : b.minor - a.minor) : b.major - a.major;
    });

    if (version === "latest") return versions[0].name || null;

    const parsed = /^([\^~]{1})?([\d\*xX]+)(\.([\d\*xX]+))?(\.([\d\*xX]+))?$/.exec(version);

    if (!parsed) return null;
    const compat = parsed[1] === "^";
    const close = parsed[1] === "~";

    //Get final requirements
    const maj = isNaN(parsed[2]) ? ">=0" : Number(parsed[2]);
    const min = !isNaN(parsed[4]) ? (compat ? ">=" + parsed[4] : Number(parsed[4])) : (parsed[4] || compat || close ? ">=0" : ">=0");
    const pat = !isNaN(parsed[6]) ? (compat || close ? ">=" + parsed[6] : Number(parsed[6])) : (parsed[6] || compat || close ? ">=0" : ">=0");

    function comparePart(part, match) {

        if (isNaN(match)) {
            if (part >= Number(match.substr(2))) return true;
        } else {
            if (part === match) return true;
        }

        return false;
    }

    for (let v = 0; v < versions.length; v++) {
        const checkVersion = versions[v];

        if (comparePart(checkVersion.major, maj) && comparePart(checkVersion.minor, min) && comparePart(checkVersion.patch, pat))
            return checkVersion.name;
    }

    return null;
};



module.exports = {
    logError: logError,
    font: font,
    semverReg:semverReg,
    fatalError: fatalError,
    success: success,
    resolveVersionNumber: resolveVersionNumber
}