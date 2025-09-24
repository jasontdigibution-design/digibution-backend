const express = require('express');
const multer = require('multer');
const cors = require('cors');
const driveService = require('./google-drive-service');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CORS FIX FOR DEBUGGING ---
// The previous, more restrictive configuration is commented out.
// This new line allows your server to accept requests from ANY website,
// which will help us verify that the connection is working.
//
// const corsOptions = {
//   origin: 'https://www.digibutionnetwork.com',
//   optionsSuccessStatus: 200
// };
// app.use(cors(corsOptions));

app.use(cors()); // Temporarily allow all origins

// -----------------------------

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/datafile - Handles new file uploads
app.post('/api/datafile', upload.single('dataFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.memberId) {
            return res.status(400).json({ message: 'File and Member ID are required.' });
        }
        const fileInfo = await driveService.uploadFile(req.file, req.body.memberId);
        res.status(201).json({ 
            message: `File '${fileInfo.fileName}' uploaded successfully!`,
            ...fileInfo 
        });
    } catch (error) {
        console.error('Upload endpoint error:', error);
        res.status(500).json({ message: 'An error occurred on the server during upload.' });
    }
});

// GET /api/datafile - Checks for an existing file for a member
app.get('/api/datafile', async (req, res) => {
    const memberId = req.query.memberId;
    if (!memberId) {
        return res.status(400).json({ message: 'Member ID is required.' });
    }
    try {
        const fileInfo = await driveService.findFileByMemberId(memberId);
        res.json(fileInfo || { fileName: null, fileUrl: null });
    } catch (error) {
        console.error('Get file info error:', error);
        res.status(500).json({ message: 'Error fetching file information.' });
    }
});

// DELETE /api/datafile - Deletes a member's file
app.delete('/api/datafile', async (req, res) => {
    const { memberId } = req.body;
    if (!memberId) {
        return res.status(400).json({ message: 'Member ID is required.' });
    }
    try {
        await driveService.deleteFile(memberId);
        res.json({ message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Delete endpoint error:', error);
        res.status(500).json({ message: 'Error deleting file.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is listening on port ${PORT}`);
});



