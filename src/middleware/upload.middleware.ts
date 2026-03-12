import multer from 'multer';
import path from 'path';
import crypto from 'crypto';

const ALLOWED_MIME_TYPES = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
];

const ALLOWED_SPREADSHEET_MIME_TYPES = [
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SPREADSHEET_SIZE = 20 * 1024 * 1024; // 20MB

const storage = multer.memoryStorage();

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Solo se permiten imágenes JPEG, PNG, GIF o WebP'));
    }
};

const spreadsheetFileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const looksLikeSpreadsheet = ext === '.xlsx' || ext === '.xls' || ext === '.csv';
    if (ALLOWED_SPREADSHEET_MIME_TYPES.includes(file.mimetype) || looksLikeSpreadsheet) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de archivo no permitido. Sube un .xlsx o .csv'));
    }
};

const sanitizeFilename = (filename: string): string => {
    const ext = path.extname(filename).toLowerCase();
    const name = path.basename(filename, ext);
    const sanitized = name
        .replace(/[^a-zA-Z0-9-_]/g, '')
        .substring(0, 50);
    const randomSuffix = crypto.randomBytes(4).toString('hex');
    return `${sanitized}-${randomSuffix}${ext}`;
};

const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: 2
    },
    fileFilter
});

const uploadSpreadsheet = multer({
    storage,
    limits: {
        fileSize: MAX_SPREADSHEET_SIZE,
        files: 1
    },
    fileFilter: spreadsheetFileFilter
});

export const uploadSingleImage = (req: any, res: any, next: any) => {
    upload.single('imagen')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'La imagen es demasiado grande. El límite es de 10MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

export const uploadSingleSpreadsheet = (req: any, res: any, next: any) => {
    uploadSpreadsheet.single('archivo')(req, res, (err: any) => {
        if (err instanceof multer.MulterError) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                return res.status(400).json({ error: 'El archivo es demasiado grande. El límite es de 20MB.' });
            }
            return res.status(400).json({ error: `Error en la subida: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ error: err.message });
        }
        next();
    });
};

export { sanitizeFilename, ALLOWED_MIME_TYPES, MAX_FILE_SIZE, ALLOWED_SPREADSHEET_MIME_TYPES, MAX_SPREADSHEET_SIZE };
export default upload;
