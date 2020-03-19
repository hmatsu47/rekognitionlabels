const express = require('express');
const multer = require("multer");
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const fs = require('fs')
const mysqlx = require('@mysql/xdevapi');

const filePath = '/dev/nginx-1.17.9/html/images/';

const app = express();

// for POST request (use body-perser)
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(bodyParser.json());

// for AWS Rekognition (convert file -> base64)
function getBase64BufferFromFile(filename) {
    return (new Promise((resolve, reject) => {
        fs.readFile(filename, 'base64', (err, data) => {
            if (err) return reject(err);
            resolve(new Buffer.from(data, 'base64'));
        });
    }));
}

// Amazon Rekognition (detect labels)
AWS.config.update({
    region: 'ap-northeast-1'
});

const rekognition = new AWS.Rekognition({
    apiVersion: '2016-06-27'
});

function detectLabelsFromBytes(bytes, maxLabels, minConfidence) {
    const params = {
        Image: {
            Bytes: bytes
        },
        MaxLabels: typeof maxLabels !== 'undefined' ? maxLabels : 100,
        MinConfidence: typeof minConfidence !== 'undefined' ? minConfidence : 60.0
    };
    return (new Promise((resolve, reject) => {
        rekognition.detectLabels(params, (err, data) => {
            if (err) return reject(err);
            resolve(data);
        });
    }));
}

// for MySQL document (convert array format)
function convertArray(detectLabels) {
    let resultArray = [];
    detectLabels.forEach(element => resultArray.push(element.Name));
    return resultArray;
}

// for Label selector (convert resultSet format)
function convertResultSet(rows) {
    let resultArray = [];
    rows.forEach((element, index) => {
        if (index == 0) {
            resultArray.push(element);
        }
    });
    return resultArray[0];
}

// for Data loader (convert resultSet format)
function convertResultSetData(rows) {
    let resultArray = [];
    rows.forEach(element => resultArray.push(element));
    return resultArray[0];
}

// for Initiator (remove image files)
function removeFiles() {
    const targetFiles = fs.readdirSync(filePath);
    targetFiles.forEach(targetFile => fs.unlinkSync(filePath + targetFile));
}

// for HTTP response ('OK':HTTP 200)
function responseOK(res) {
    responseResult(res, {"message": "OK"});
}

// for HTTP response (with result:HTTP 200)
function responseResult(res, result) {
    res.send(result);
}

// for HTTP response (error:HTTP 400)
function responseError400(error, res, message) {
    responseError(error, res, message, 400);
}
    
// for HTTP response (error:HTTP 500)
function responseError500(error, res, message) {
    responseError(error, res, message, 500);
}

// for HTTP response (error)
function responseError(error, res, message, code) {
    console.log('[ERROR]', error);
    const messageString = '[ERROR] ' + message; 
    res.status(code).send({"message": messageString});
}

// MySQL X DevAPI
const schemaName = 'xdevtest';
const collectionName = 'image_labeling';
const labelTableName = 'labels';
const connectParam = 'mysqlx://xdevuser:XDevAPIUser8.0@localhost:33060/' + schemaName;

// API:Upload image and detect labels
const wepAPIPort = 38080;
const detectMaxLabels = 10;
const detectMinConfidence = 60.0;

app.post('/upload_image', multer({dest: filePath}).single('imageFile'), (req, res) => {
    if (req.file.size > (5*1024*1024)) {
        responseError400('File Size Exceeded. (>5MB)', res, 'Cannot Upload File.');
        return;
    }
    (async () => {
        try {
            // Detect Labels by Amazon Rekognition
            const bytes = await getBase64BufferFromFile(req.file.path);
            const found = await detectLabelsFromBytes(bytes, detectMaxLabels, detectMinConfidence);
            // Store Labels in MySQL Document Store
            const session = await mysqlx.getSession(connectParam);
            const collection = await session.getSchema(schemaName).getCollection(collectionName);
            const labels = convertArray(found.Labels);
            const dummy = await collection.add({
                    "filename": req.file.filename, 
                    "originalname": req.file.originalname, 
                    "labels": labels
                }).execute();
            // Store Labels (for Selector) in MySQL Table
            const table = await session.getSchema(schemaName).getTable(labelTableName);
            await Promise.all(
                labels.map(async label =>
                    await table.insert('label')
                        .values(label)
                        .execute()));
            responseOK(res);
        } catch(error) {
            responseError500(error, res, 'Cannot Detect Labels / Store Data.');
        }
    })();
});

// API:Get label selector
app.post('/get_labels', (req, res) => {
    (async () => {
        try {
            const rows = [];
            const session = await mysqlx.getSession(connectParam);
            const table = await session.getSchema(schemaName).getTable(labelTableName);
            const dummy = await table.select('`label`', 'COUNT(`label`) AS `count`')
                .groupBy('`label`')
                .orderBy('`count` DESC', '`label` ASC')
                .limit(typeof req.body.numof !== 'undefined' ? req.body.numof : 100)
                .execute(row => rows.push(convertResultSet(row)));
            responseResult(res, {"labels" : rows});
        } catch(error) {
            responseError500(error, res, 'Cannot Get Labels.');
        }
    })();
});

// API:Select data from MySQL
app.post('/select_data', (req, res) => {
    (async () => {
        try {
            const rows = [];
            const session = await mysqlx.getSession(connectParam);
            const table = await session.getSchema(schemaName).getTable(collectionName);
            const dummy = await table.select('`doc`')
                .where(JSON.stringify(req.body.labels) + " in `doc`->'$.labels'")
                .limit(typeof req.body.numof !== 'undefined' ? req.body.numof : 100)
                .execute(row => rows.push(convertResultSetData(row)));
            responseResult(res, {"documents": rows});
        } catch(error) {
            responseError500(error, res, 'Cannot Select Documents.');
        }
    })();
});

// API:Get data from MySQL
app.post('/get_data', (req, res) => {
    (async () => {
        try {
            const rows = [];
            const session = await mysqlx.getSession(connectParam);
            const table = await session.getSchema(schemaName).getTable(collectionName);
            const dummy = await table.select('`doc`')
                .limit(typeof req.body.numof !== 'undefined' ? req.body.numof : 100)
                .execute(row => rows.push(convertResultSetData(row)));
            responseResult(res, {"documents": rows});
        } catch(error) {
            responseError500(error, res, 'Cannot Get Documents.');
        }
    })();
});

// API:Initialize data
app.post('/init_data', (req, res) => {
    // Remove Image Files
    removeFiles();
    (async () => {
        try {
            // Create Collection
            const session = await mysqlx.getSession(connectParam);
            const collection = await session.getSchema(schemaName).createCollection(collectionName);
            const flag = await collection.createIndex('labels', 
                {fields: [{"field": "$.labels", "type":"CHAR(100)", "array": true}]});
            // Create MySQL Table
            const query = 'CREATE TABLE `' + schemaName + '`.`' + labelTableName +
                '` (`id` INT NOT NULL PRIMARY KEY AUTO_INCREMENT, `label` VARCHAR(100) NOT NULL, INDEX `label` (`label`)' +
                ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';
            const dummy = await session.sql(query)
                .execute();
            responseOK(res);
        } catch(error) {
            responseError500(error, res, 'Cannot Create Collection.');
        }
    })();
});

// API:Drop data
app.post('/drop_data', (req, res) => {
    // Remove Image Files
    removeFiles();
    (async () => {
        try {
            // Drop Collection
            const session = await mysqlx.getSession(connectParam);
            const flag = await session.getSchema(schemaName).dropCollection(collectionName);
            // Drop Table
            const query = 'DROP TABLE IF EXISTS `' + schemaName + '`.`' + labelTableName + '`'
            const dummy = await session.sql(query)
                .execute();
            responseOK(res);
        } catch(error) {
            responseError500(error, res, 'Cannot Drop Collection / Table.');
        }
    })();
});

// Express:Web API server
const server = app.listen(wepAPIPort, () => {
    console.log('[INFO]listening at port %s', server.address().port);
});