"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const init_1 = __importDefault(require("../database/init"));
const router = (0, express_1.Router)();
// Public endpoint to get organization settings
router.get('/organization', (req, res) => {
    try {
        const org = init_1.default.prepare('SELECT * FROM organizations LIMIT 1').get();
        if (!org) {
            return res.status(404).json({ error: 'Organization not found' });
        }
        res.json(org);
    }
    catch (error) {
        console.error('Get organization error:', error);
        res.status(500).json({ error: 'Failed to fetch organization' });
    }
});
exports.default = router;
//# sourceMappingURL=settings.js.map