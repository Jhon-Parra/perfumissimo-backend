"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_SPREADSHEET_SIZE = exports.ALLOWED_SPREADSHEET_MIME_TYPES = exports.MAX_FILE_SIZE = exports.ALLOWED_MIME_TYPES = exports.sanitizeFilename = exports.uploadSingleSpreadsheet = exports.uploadSingleImage = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];
exports.ALLOWED_MIME_TYPES = ALLOWED_MIME_TYPES;
const ALLOWED_SPREADSHEET_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
];
exports.ALLOWED_SPREADSHEET_MIME_TYPES = ALLOWED_SPREADSHEET_MIME_TYPES;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
exports.MAX_FILE_SIZE = MAX_FILE_SIZE;
const MAX_SPREADSHEET_SIZE = 20 * 1024 * 1024; // 20MB
exports.MAX_SPREADSHEET_SIZE = MAX_SPREADSHEET_SIZE;
const storage = multer_1.default.memoryStorage();
const fileFilter = (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
    }
};
const spreadsheetFileFilter = (req, file, cb) => {
    const ext = path_1.default.extname(file.originalname || '').toLowerCase();
    const looksLikeSpreadsheet = ext === '.xlsx' || ext === '.xls' || ext === '.csv';
    if (ALLOWED_SPREADSHEET_MIME_TYPES.includes(file.mimetype) || looksLikeSpreadsheet) {
        cb(null, true);
    }
    else {
        cb(new Error('Tipo de archivo no permitido. Sube un .xlsx o .csv'));
    }
};
const sanitizeFilename = (filename) => {
    const ext = path_1.default.extname(filename).toLowerCase();
    const name = path_1.default.basename(filename, ext);
    const sanitized = name
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .substring(0, 50);
    const randomSuffix = crypto_1.default.randomBytes(4).toString('hex');
    return `${sanitized}-${randomSuffix}${ext}`;
};
exports.sanitizeFilename = sanitizeFilename;
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 2
    },
    fileFilter
});
const uploadSpreadsheet = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: MAX_SPREADSHEET_SIZE,
        files: 1
    },
    fileFilter: spreadsheetFileFilter
});
const uploadSingleImage = (req, res, next) => {
    upload.single('imagen')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen es demasiado grande. El límite es de 10MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadSingleImage = uploadSingleImage;
const uploadSingleSpreadsheet = (req, res, next) => {
    uploadSpreadsheet.single('archivo')(req, res, (err) => {
        if (err instanceof multer_1.default.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 20MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        }
        else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};
exports.uploadSingleSpreadsheet = uploadSingleSpreadsheet;
exports.default = upload;
