'use strict';
// var CONFIG = require('../Config');
// var UniversalFunctions = require('../Utils/UniversalFunctions');
var async = require('async');
var Path = require('path');
var knox = require('knox');
var fsExtra = require('fs-extra');
var fs= require('fs');
var AWS = require('aws-sdk');
// var Logger = require('../logging').Logger.child({module: 'Lib', resource: 'NotificationManager'});
///*
// 1) Save Local Files
// 2) Create Thumbnails
// 3) Upload Files to S3
// 4) Delete Local files
// */
//




var deleteFile= function deleteFile(path, callback) {

    fs.unlink(path, function (err) {

        if (err) {
            Logger.error(err);
            var error = {
                response: {
                    message: "Something went wrong",
                    data: {}
                },
                statusCode: 500
            };
            return callback(error);
        } else
            return callback(null);
    });

}

var uploadImageToS3Bucket= function uploadImageToS3Bucket(file, isThumb, callback) {

    var path = file.path, filename = file.name, folder = file.s3Folder, mimeType = file.mimeType;

    if (isThumb) {
        path = path + 'thumb/';
        filename = file.thumbName;
        folder = file.s3FolderThumb;
    }

    // var filename = file.name; // actual filename of file
    // var path = file.path; //will be put into a temp directory
    // var mimeType = file.type;

    var accessKeyId = CONFIG.AWS_CONFIG.s3BucketCredentials.accessKeyId;
    var secretAccessKeyId = CONFIG.AWS_CONFIG.s3BucketCredentials.secretAccessKey;
    //var bucketName = CONFIG.AWS_CONFIG.s3BucketCredentials.bucket;

    //Logger.debug("UPLOAD", file);
    //Logger.debug("path to read::"+path + filename);

    fs.readFile(path + filename, function (error, fileBuffer) {
        //  //Logger.debug("UPLOAD", file_buffer);
        //Logger.debug("path to read from temp::"+path + filename);
        if (error) {
            Logger.error("UPLOAD", error,fileBuffer);
            var errResp = {
                response: {
                    message: "Something went wrong",
                    data: {}
                },
                statusCode: 500
            };
            return callback(errResp);
        }

        //filename = file.name;
        AWS.config.update({accessKeyId: accessKeyId, secretAccessKey: secretAccessKeyId});
        var s3bucket = new AWS.S3();
        var params = {
            Bucket: CONFIG.AWS_CONFIG.s3BucketCredentials.bucket,
            Key: folder + '/' + filename,
            Body: fileBuffer,
            ACL: 'public-read',
            ContentType: mimeType
        };

        s3bucket.putObject(params, function (err, data) {

            if (err) {
                 Logger.error("PUT", err,data);
                var error = {
                    response: {
                        message: "Something went wrong",
                        data: {}
                    },
                    statusCode: 500
                };
                return callback(error);
            }
            else {
                //Logger.debug("just testing");
                //Logger.debug(data);
                deleteFile(path + filename, function (err) {
                    if (err)
                        return callback(err);
                    else
                        return callback(null);
                })
            }
        });
    });
};

function initParallelUpload(fileObj, withThumb, callbackParent) {

    async.parallel([
        function (callback) {
            //Logger.debug("uploading image");
            uploadImageToS3Bucket(fileObj, false, callback);
        },
        function (callback) {
            if (withThumb)
            {
                //Logger.debug("uploading thumbnil");
                uploadImageToS3Bucket(fileObj, true, callback);
            }
            else
                callback(null);
        }
    ], function (error) {
        if (error)
            callbackParent(error);
        else
            callbackParent(null);
    })

}
var saveFile= function saveFile(fileData, path, callback) {

    //var path = Path.resolve(".") + "/uploads/" + folderPath + "/" + fileName;

    var file = fs.createWriteStream(path);
    //Logger.debug("=========save file======");
    file.on('error', function (err) {

        Logger.error('@@@@@@@@@@@@@',err);
        var error = {
            response: {
                message: "Some",
                data: {}
            },
            statusCode: 500
        };
        return callback(error);
    });

    fileData.pipe(file);

    fileData.on('end', function (err) {
        if (err) {
            var error = {
                response: {
                    message: "Some",
                    data: {}
                },
                statusCode: 500
            };
            return callback(error);
        } else
            callback(null);
    });


};
var createThumbnailImage= function createThumbnailImage(path, name, callback) {
    //Logger.debug('------first-----');
    var gm = require('gm').subClass({imageMagick: true});
    var thumbPath = path + 'thumb/' + "Thumb_" + name;
    //var tmp_path = path + "-tmpPath"; //will be put into a temp directory

    gm(path + name)
        .resize(160, 160, "!")
        .autoOrient()
        .write(thumbPath, function (err) {
            //Logger.debug('createThumbnailImage');
            Logger.error(err);

            if (!err) {
                return callback(null);
            } else {
                var error = {
                    response: {
                        message: "Something went wrong",
                        data: {}
                    },
                    statusCode: 500
                };
                //Logger.debug('<<<<<<<<<<<<<<<<<',error);
                return callback(error);
            }
        })
};
function uploadFile(otherConstants, fileDetails, createThumbnail, callbackParent) {
    var filename = fileDetails.name;
    var TEMP_FOLDER = otherConstants.TEMP_FOLDER;
    var s3Folder = otherConstants.s3Folder;
    var file = fileDetails.file;
    var mimiType = file.hapi.headers['content-type'];
    async.waterfall([
        function (callback) {
            console.log('TEMP_FOLDER + filename'+ TEMP_FOLDER + filename)
            saveFile(file, TEMP_FOLDER + filename, callback);
            //Logger.debug("*******save File******",callback)
        },
        function (callback) {
            if (createThumbnail){
                createThumbnailImage(TEMP_FOLDER, filename, callback);
                //Logger.debug("*******thumbnailImage********",callback)
            }

            else
                callback(null);
        },
        function (callback) {
            var fileObj = {
                path: TEMP_FOLDER,
                name: filename,
                thumbName: "Thumb_" + filename,
                mimeType: mimiType,
                s3Folder: s3Folder
            };
            if (createThumbnail)
                fileObj.s3FolderThumb = otherConstants.s3FolderThumb;
            initParallelUpload(fileObj, createThumbnail, callback);
        }
    ], function (error) {
        if (error)
            callbackParent(error);
        else
            callbackParent(null);
    })
};

function uploadProfilePicture(profilePicture, folder, filename, callbackParent) {
    var baseFolder = folder + '/' + CONFIG.AWS_CONFIG.s3BucketCredentials.folder.profilePicture;
    var baseURL = CONFIG.AWS_CONFIG.s3BucketCredentials.s3URL + '/' + baseFolder + '/';
    var urls = {};
    async.waterfall([
            function (callback) {
                var profileFolder = CONFIG.AWS_CONFIG.s3BucketCredentials.folder.original;
                var profileFolderThumb =CONFIG.AWS_CONFIG.s3BucketCredentials.folder.thumb;
                var profilePictureName = UniversalFunctions.generateFilenameWithExtension(profilePicture.hapi.filename, "Profile_" + filename);
                var s3Folder = baseFolder + '/' + profileFolder;
                var s3FolderThumb = baseFolder + '/' + profileFolderThumb;
                var profileFolderUploadPath = "customer/profilePicture";
                var path = Path.resolve("..") + "/uploads/" + profileFolderUploadPath + "/";
                var fileDetails = {
                    file: profilePicture,
                    name: profilePictureName
                };
                var otherConstants = {
                    TEMP_FOLDER: path,
                    s3Folder: s3Folder,
                    s3FolderThumb: s3FolderThumb
                };
                console.log("other constants======",otherConstants);
                urls.profilePicture = baseURL + profileFolder + '/' + profilePictureName;
                urls.profilePictureThumb = baseURL + profileFolderThumb + '/Thumb_' + profilePictureName;
                uploadFile(otherConstants, fileDetails, true, callback);
            }
        ],

        function (error) {
            if (error) {
                //Logger.debug("upload image error :: ", error);
                callbackParent(error);
            }
            else {
                //Logger.debug("upload image result :", urls);


                //Logger.debug('hello');
                //Logger.debug(urls);
                callbackParent(null, urls);
            }
        })
}
var uploadFileDocuments = function (otherConstants, fileDetails, callbackParent) {
    var filename = fileDetails.name;
    var TEMP_FOLDER = otherConstants.TEMP_FOLDER;
    var s3Folder = otherConstants.s3Folder;
    var file = fileDetails.file;
    var mimiType = file.hapi.headers['content-type'];
    async.waterfall([
        function (callback) {
            //Logger.debug('TEMP_FOLDER + filename' + TEMP_FOLDER + filename)
            saveFile(file, TEMP_FOLDER + filename, callback);
        },
        function (callback) {
            var fileObj = {
                path: TEMP_FOLDER,
                name: filename,
                mimeType: mimiType,
                s3Folder: s3Folder
            };
            initParallelUpload(fileObj, false, callback);
        }
    ], function (error) {
        if (error)
            callbackParent(error);
        else
            callbackParent(null);
    })
};

function deleteImagefromAWS(images, callback) {
    var objects = [];
    // for (var k in images) {
    //     objects.push({Key: images[k].fileName});
    // }
    console.log("objects--------", JSON.stringify(objects));
    var s3 = new AWS.S3();
    var params = {
        Bucket: CONFIG.AWS_CONFIG.s3BucketCredentials.bucket,
        Delete:{
          Objects:[{
            Key:images
          }]

      }
        // Delete: {
        //     Objects: objects
        // }
    };
    console.log("PARAMS------------", params);
    s3.deleteObjects(params, function (err, data) {
        if (err) console.log(err, err.stack);
        else {
            console.log("Data-----------", data);
            callback(null, data);
        }
    });
}

module.exports = {
    uploadProfilePicture: uploadProfilePicture,
    uploadFile:uploadFile,
    uploadFileDocuments:uploadFileDocuments,
    deleteImagefromAWS:deleteImagefromAWS
};
