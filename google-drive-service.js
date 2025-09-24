const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

// --- Configuration ---
const KEY_FILE_PATH = path.join(__dirname, 'credentials.json');
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID;
const DB_PATH = path.join(__dirname, 'db.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];

if (!FOLDER_ID) {
    throw new Error("The GOOGLE_DRIVE_FOLDER_ID environment variable is not set.");
}

// --- CREDENTIALS FIX ---
// Read the contents of the credentials file and parse it into a JSON object.
// This is more robust for server environments like Render.
const credentials = JSON.parse(fs.readFileSync(KEY_FILE_PATH));

// Initialize authentication by passing the credentials object directly,
// instead of using the file path.
const auth = new google.auth.GoogleAuth({ credentials, scopes: SCOPES });
// --------------------

const drive = google.drive({ version: 'v3', auth });

const readDb = () => {
    if (!fs.existsSync(DB_PATH)) return {};
    try {
        const data = fs.readFileSync(DB_PATH);
        if (!data || data.length === 0) return {};
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading or parsing db.json:", e);
        return {}; 
    }
};

const writeDb = (db) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

const uploadFile = async (fileObject, memberId) => {
    const existingFile = await findFileByMemberId(memberId);
    if (existingFile && existingFile.fileId) {
        await deleteFile(memberId);
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    let createdFile;
    try {
        console.log("Attempting to create file in Google Drive...");
        const response = await drive.files.create({
            media: {
                mimeType: fileObject.mimeType,
                body: bufferStream,
            },
            requestBody: {
                name: `${memberId}-${fileObject.originalname}`,
                parents: [FOLDER_ID],
            },
            fields: 'id',
        });
        createdFile = response.data;
        console.log("Successfully created file with ID:", createdFile.id);
    } catch (error) {
        console.error('!!! Google Drive API Error during file creation:', error.message);
        throw new Error('Failed to create file in Google Drive.');
    }

    try {
        console.log("Attempting to set file permissions...");
        await drive.permissions.create({
            fileId: createdFile.id,
            requestBody: {
                role: 'reader',
                type: 'anyone',
            },
        });
        console.log("Successfully set permissions.");
    } catch (error) {
        console.error('!!! Google Drive API Error during permission setting:', error.message);
        throw new Error('Failed to set file permissions in Google Drive.');
    }

    let fileWithUrl;
    try {
        console.log("Attempting to get file metadata (webViewLink)...");
        const response = await drive.files.get({
            fileId: createdFile.id,
            fields: 'webViewLink',
        });
        fileWithUrl = response.data;
        console.log("Successfully retrieved webViewLink.");
    } catch (error) {
        console.error('!!! Google Drive API Error during metadata retrieval:', error.message);
        throw new Error('Failed to retrieve file metadata from Google Drive.');
    }
    
    const db = readDb();
    const fileInfo = { 
        fileId: createdFile.id, 
        fileName: fileObject.originalname, 
        fileUrl: fileWithUrl.webViewLink 
    };
    db[memberId] = fileInfo;
    writeDb(db);

    console.log(`Upload process complete for member ${memberId}`);
    return fileInfo;
};

const deleteFile = async (memberId) => {
    const db = readDb();
    const fileInfo = db[memberId];
    if (!fileInfo || !fileInfo.fileId) { return; }

    try {
        await drive.files.delete({ fileId: fileInfo.fileId });
        console.log(`Deleted file ${fileInfo.fileId} for member ${memberId}`);
    } catch (error) {
        console.error(`Error deleting file from Drive: ${error.message}`);
    }

    delete db[memberId];
    writeDb(db);
};

const findFileByMemberId = async (memberId) => {
    const db = readDb();
    return db[memberId] || null;
};

module.exports = { uploadFile, deleteFile, findFileByMemberId };



