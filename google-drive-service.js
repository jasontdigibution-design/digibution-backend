const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const stream = require('stream');

// --- CONFIGURATION ---
const KEY_FILE_PATH = path.join(__dirname, 'credentials.json');
const FOLDER_ID = process.env.GOOGLE_DRIVE_FOLDER_ID; // <-- THIS LINE IS UPDATED
const DB_PATH = path.join(__dirname, 'db.json');
const SCOPES = ['https://www.googleapis.com/auth/drive'];
// --------------------

// This check ensures the app won't start on Render without the folder ID
if (!FOLDER_ID) {
    throw new Error("The GOOGLE_DRIVE_FOLDER_ID environment variable is not set.");
}

const auth = new google.auth.GoogleAuth({
    keyFile: KEY_FILE_PATH,
    scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

/**
 * Reads the mapping of memberId to fileId from the JSON DB.
 * @returns {object} The database object.
 */
const readDb = () => {
    // In a server environment like Render, the DB file might not exist initially.
    if (!fs.existsSync(DB_PATH)) {
        return {};
    }
    const data = fs.readFileSync(DB_PATH);
    return JSON.parse(data);
};

/**
 * Writes the mapping of memberId to fileId to the JSON DB.
 * @param {object} db The database object to write.
 */
const writeDb = (db) => {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
};

/**
 * Uploads a file to Google Drive. If a file for the member already exists, it's replaced.
 * @param {object} fileObject The file object from multer.
 * @param {string} memberId The ID of the member.
 * @returns {object} The metadata of the uploaded file.
 */
const uploadFile = async (fileObject, memberId) => {
    // If a file already exists for this member, delete it first.
    const existingFile = await findFileByMemberId(memberId);
    if (existingFile && existingFile.fileId) {
        await deleteFile(memberId);
    }

    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);

    const { data } = await drive.files.create({
        media: {
            mimeType: fileObject.mimeType,
            body: bufferStream,
        },
        requestBody: {
            name: `${memberId}-${fileObject.originalname}`, // Prepend memberId for uniqueness
            parents: [FOLDER_ID],
        },
        fields: 'id, name',
    });

    // Save mapping to our DB
    const db = readDb();
    db[memberId] = { fileId: data.id, fileName: fileObject.originalname };
    writeDb(db);

    console.log(`Uploaded file ${data.name} (${data.id}) for member ${memberId}`);
    return data;
};

/**
 * Deletes a file from Google Drive based on the memberId.
 * @param {string} memberId The ID of the member.
 */
const deleteFile = async (memberId) => {
    const db = readDb();
    const fileInfo = db[memberId];

    if (!fileInfo || !fileInfo.fileId) {
        console.log(`No file found for member ${memberId} to delete.`);
        return; // No file to delete
    }

    try {
        await drive.files.delete({
            fileId: fileInfo.fileId,
        });
        console.log(`Deleted file ${fileInfo.fileId} for member ${memberId}`);
    } catch (error) {
        // It's possible the file was already deleted from Drive manually
        console.error(`Error deleting file from Drive: ${error.message}`);
    }

    // Remove from our DB
    delete db[memberId];
    writeDb(db);
};

/**
 * Finds a file's info from our database.
 * @param {string} memberId The ID of the member.
 * @returns {object|null} The file info or null if not found.
 */
const findFileByMemberId = async (memberId) => {
    const db = readDb();
    return db[memberId] || null;
};

module.exports = { uploadFile, deleteFile, findFileByMemberId };