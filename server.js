const express = require('express');
const multer = require('multer');
const cors = require('cors');
const driveService = require('./google-drive-service');

const app = express();
const PORT = 3000;

// --- CORS CONFIGURATION ---
// This is the crucial update. We are explicitly allowing your website's
// domain to communicate with this server.
const corsOptions = {
  origin: 'https://www.digibutionnetwork.com',
  optionsSuccessStatus: 200 // For legacy browser support
};

app.use(cors(corsOptions));
// -------------------------

app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/datafile - Handles new file uploads
app.post('/api/datafile', upload.single('dataFile'), async (req, res) => {
    try {
        if (!req.file || !req.body.memberId) {
            return res.status(400).json({ message: 'File and Member ID are required.' });
        }
        await driveService.uploadFile(req.file, req.body.memberId);
        res.status(201).json({ message: `File '${req.file.originalname}' uploaded successfully!` });
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
    console.log(`Backend server is running at http://localhost:${PORT}`);
});
```

### Next Steps

1.  **Update `server.js` on Your Computer:** Replace the code in your local `server.js` file with the new code above.
2.  **Push the Change to GitHub:** Open your terminal in the project folder and run these commands to update your repository:
    ```bash
    git add server.js
    git commit -m "Configure CORS for specific domain"
    git push
    


    

