const express = require('express');
const multer = require('multer');
const cors = require('cors');
const driveService = require('./google-drive-service');

const app = express();
const PORT = 3000;

// Use CORS to allow cross-origin requests from your website
app.use(cors()); // In production, configure this more securely!
app.use(express.json()); // To parse JSON bodies like in the DELETE request

// Multer will store the uploaded file in memory as a buffer
const upload = multer({ storage: multer.memoryStorage() });

// --- API ROUTES ---

// POST /api/datafile - Handles new file uploads
app.post('/api/datafile', upload.single('dataFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file was uploaded.' });
        }
        if (!req.body.memberId) {
            return res.status(400).json({ message: 'Member ID is required.' });
        }

        // ⚠️ SECURITY CHECK: In a real app, you would verify the memberId
        // belongs to the logged-in user or if the user is an admin.
        // Example: if (!isAdmin(req.user) && req.user.id !== req.body.memberId) return res.status(403).send('Forbidden');

        await driveService.uploadFile(req.file, req.body.memberId);
        res.status(201).json({ message: `File '${req.file.originalname}' uploaded successfully!` });

    } catch (error) {
        console.error('Upload endpoint error:', error);
        res.status(500).json({ message: 'An error occurred on the server.' });
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
        if (fileInfo) {
            res.json({ fileName: fileInfo.fileName });
        } else {
            res.json({ fileName: null });
        }
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

    // ⚠️ SECURITY CHECK: Add admin/ownership check here as well.

    try {
        await driveService.deleteFile(memberId);
        res.json({ message: 'File deleted successfully.' });
    } catch (error) {
        console.error('Delete endpoint error:', error);
        res.status(500).json({ message: 'Error deleting file.' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server is running at http://localhost:${PORT}`);
});