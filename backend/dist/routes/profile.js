"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const init_1 = __importDefault(require("../database/init"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Create uploads directory if it doesn't exist
const uploadsDir = path_1.default.join(__dirname, '../../uploads');
if (!fs_1.default.existsSync(uploadsDir)) {
    fs_1.default.mkdirSync(uploadsDir, { recursive: true });
}
// Configure multer for profile picture uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'profile-' + uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path_1.default.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            return cb(null, true);
        }
        else {
            cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
        }
    }
});
// All routes require authentication
router.use(auth_1.authenticate);
// Get current user profile
router.get('/me', (req, res) => {
    try {
        const user = init_1.default.prepare('SELECT id, email, name, role, profile_picture, phone_number, created_at FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Failed to fetch profile' });
    }
});
router.put('/me', (req, res) => {
    try {
        const { phone_number } = req.body;
        const user = init_1.default.prepare('SELECT role FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.role !== 'trainer') {
            return res.status(403).json({ error: 'Only trainers can update phone number' });
        }
        const normalizedPhone = typeof phone_number === 'string' ? phone_number.trim() : '';
        if (normalizedPhone.length > 30) {
            return res.status(400).json({ error: 'Phone number is too long' });
        }
        init_1.default.prepare('UPDATE users SET phone_number = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(normalizedPhone.length > 0 ? normalizedPhone : null, req.user.id);
        const updatedUser = init_1.default.prepare('SELECT id, email, name, role, profile_picture, phone_number, created_at FROM users WHERE id = ?').get(req.user.id);
        res.json({ message: 'Profile updated successfully', user: updatedUser });
    }
    catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ error: 'Failed to update profile' });
    }
});
// Update password
router.put('/password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        if (!currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Current password and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters' });
        }
        // Get current user with password
        const user = init_1.default.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Verify current password
        const isValidPassword = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Current password is incorrect' });
        }
        // Hash new password
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 10);
        // Update password
        init_1.default.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(hashedPassword, req.user.id);
        res.json({ message: 'Password updated successfully' });
    }
    catch (error) {
        console.error('Update password error:', error);
        res.status(500).json({ error: 'Failed to update password' });
    }
});
// Upload profile picture
router.post('/picture', upload.single('picture'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        // Get old profile picture
        const dbUser = init_1.default.prepare('SELECT profile_picture FROM users WHERE id = ?').get(req.user.id);
        // Delete old profile picture if it exists
        if (dbUser?.profile_picture) {
            const oldPath = path_1.default.join(__dirname, '../..', dbUser.profile_picture);
            if (fs_1.default.existsSync(oldPath)) {
                fs_1.default.unlinkSync(oldPath);
            }
        }
        // Save new profile picture path
        const picturePath = '/uploads/' + req.file.filename;
        init_1.default.prepare('UPDATE users SET profile_picture = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(picturePath, req.user.id);
        res.json({
            message: 'Profile picture uploaded successfully',
            profile_picture: picturePath
        });
    }
    catch (error) {
        console.error('Upload profile picture error:', error);
        res.status(500).json({ error: 'Failed to upload profile picture' });
    }
});
// Delete profile picture
router.delete('/picture', (req, res) => {
    try {
        const user = init_1.default.prepare('SELECT profile_picture FROM users WHERE id = ?').get(req.user.id);
        if (user?.profile_picture) {
            // Delete file
            const filePath = path_1.default.join(__dirname, '../..', user.profile_picture);
            if (fs_1.default.existsSync(filePath)) {
                fs_1.default.unlinkSync(filePath);
            }
            // Remove from database
            init_1.default.prepare('UPDATE users SET profile_picture = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.user.id);
            res.json({ message: 'Profile picture deleted successfully' });
        }
        else {
            res.status(404).json({ error: 'No profile picture to delete' });
        }
    }
    catch (error) {
        console.error('Delete profile picture error:', error);
        res.status(500).json({ error: 'Failed to delete profile picture' });
    }
});
exports.default = router;
//# sourceMappingURL=profile.js.map