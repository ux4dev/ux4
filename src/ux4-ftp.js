const UX4Tool = require("./ux4-tool.js");
const Utils = require("./utils.js");
const File = require('fs-extra');
const Path = require('path');

//Get build as stream
function getBuildBuffer(address, version, filename) {

    return new Promise(async (resolve, reject) => {

        try {

            if (UX4Tool.params.fromDir || UX4Tool.config.fromDir) {

                //Make sure to include trailing seperator
                if (!address.endsWith(Path.sep)) {
                    address = address + Path.sep;
                }

                //Concat full path
                filePath = address + version + Path.sep + filename + ".zip";
                if (!File.existsSync(filePath)) {
                    reject("Specified version (" + version + UX4Tool.filenameToType(filename) + ") could not be found at location:\n" + address);
                    return;
                }

                let readStream = File.createReadStream(filePath);
                let buffers = [];
                readStream.on('data', (chunk) => { buffers.push(chunk); });
                readStream.on('end', () => { resolve(Buffer.concat(buffers)); });

            } else {

                let buffer = await getFTPBuild(address, version, filename);
                resolve(buffer);

            }

        } catch (e) {
            reject(e);
        }
    });
}

//Get build via ftp
function getFTPBuild(address, version, filename) {

    return new Promise(async (resolve, reject) => {

        try {

            //Create new ftp client
            let FTP = require("basic-ftp");
            let client = new FTP.Client();

            //Get User/Pass
            let username = UX4Tool.config.user;
            let password = UX4Tool.config.password;
            if (!password) {
                let Inquirer = require("inquirer");
                let answers = await Inquirer.prompt([
                    {
                        name: 'password',
                        type: 'password',
                        message: 'Password',
                        when: !password
                    }
                ]);
                password = answers.password || password;
            }

            //Access ftp server
            await client.access({
                host: address,
                user: username,
                password: password
            });

            //Ensure build folder for this version exists and move into it
            try {
                await client.cd("builds/" + version + "/");
            } catch (e) {
                throw { message: "Specified version (" + version + UX4Tool.filenameToType(filename) + ") could not be found" };
            }

            //Create a new write stream and buffer to read the zip down to
            let buffers = [];
            let Stream = require("stream");
            let writeStream = new Stream.Writable({
                write: function (chunk, encoding, next) {
                    buffers.push(chunk);
                    next();
                }
            });

            //Read the appropriate zip file then close client connection
            await client.download(writeStream, filename + ".zip");
            await client.close();

            //Pass back the zip buffer
            resolve(Buffer.concat(buffers));

        } catch (e) {
            reject("FTP - " + (e.error ? (e.error.message || JSON.stringify(e.error) || e.error.code) : e.message) || "error(s) occured");
        }

    });
}

//Download build from path
function downloadBuild(address, version, filename, extractPath) {

    if (!extractPath) extractPath = ".";
    

    return new Promise(async (resolve, reject) => {

        try {
            let buffer = await getBuildBuffer(address, version, filename);

            var Unzip = require("yauzl");
            Unzip.fromBuffer(buffer, { lazyEntries: true, autoClose: true }, function (err, zipfile) {

                if (err) {
                    reject(err);
                    return;
                }

                let fileIndex = 0;
                console.log("Extracting files");

                zipfile.on("entry", function (entry) {

                    console.log(Utils.font.moveback1line + "Extracting file " + (++fileIndex) + ' of ' + zipfile.entryCount);

                    if (/\/$/.test(entry.fileName)) {

                        //For directories ensure the dir exists locally ready for files then read next entry
                        File.ensureDirSync(extractPath + Path.sep + entry.fileName);
                        zipfile.readEntry();

                    } else {

                        //For files read and write the file to the local system cwd
                        zipfile.openReadStream(entry, function (err, readStream) {

                            if (err) {
                                reject(err);
                                return;
                            }

                            readStream.on("end", function () {
                                zipfile.readEntry();
                            });

                            //Write file to local dir
                            try {
                                readStream.pipe(File.createWriteStream(extractPath + Path.sep + entry.fileName));
                            } catch (e) {
                                reject(e);
                                return;
                            }
                        });
                    }
                });

                zipfile.once("end", function () {
                    console.log(Utils.font.moveback1line + 'Extracted ' + fileIndex + ' of ' + zipfile.entryCount + ' files');
                    resolve();
                });

                zipfile.on("error", function () {
                    reject(e);
                });

                zipfile.readEntry();
            });

        } catch (e) {
            reject(e);
            return;
        }

    });
}

module.exports = {
    downloadBuild: downloadBuild
};