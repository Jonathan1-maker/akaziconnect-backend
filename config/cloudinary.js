const multer = require('multer');
const path = require('path');

const getUpload = () => {
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    const cloudinary = require('cloudinary').v2;
    const { CloudinaryStorage } = require('multer-storage-cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key:    process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const storage = new CloudinaryStorage({
      cloudinary,
      params: (req, file) => ({
        folder: 'akaziconnect',
        resource_type: /pdf|doc/i.test(path.extname(file.originalname)) ? 'raw' : 'image',
        allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx'],
      }),
    });
    return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
  }
  // fallback: local disk
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}${path.extname(file.originalname)}`),
  });
  return multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });
};

// lazy proxy so it picks up env vars at request time
const upload = new Proxy({}, {
  get(_, prop) {
    return getUpload()[prop];
  }
});

module.exports = { upload };
