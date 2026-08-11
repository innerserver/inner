// REPLACE YOUR CURRENT UPLOAD ROUTE WITH THIS

const multer = require("multer");
const streamifier = require("streamifier");
const cloudinary = require("cloudinary").v2;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 * 100 }
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function uploadBuffer(buffer, folder = "inner") {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto"
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(stream);
  });
}

app.post("/api/files/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: "No file uploaded"
      });
    }

    // CLOUDINARY FIRST
    const uploaded = await uploadBuffer(req.file.buffer);

    let mongoSaved = false;

    // OPTIONAL MONGO SAVE
    try {
      await FileModel.create({
        name: req.file.originalname,
        size: req.file.size,
        mime: req.file.mimetype,
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        uploadedAt: new Date()
      });

      mongoSaved = true;
    } catch (mongoError) {
      console.error("Mongo save failed:", mongoError);
    }

    // ALWAYS RETURN SUCCESS IF CLOUDINARY WORKED
    return res.json({
      success: true,
      mongoSaved,
      file: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id
      }
    });

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      error: "Cloud upload failed"
    });
  }
});


document.addEventListener("DOMContentLoaded",()=>{
 const u=localStorage.getItem("username")||"guest";
 const r=localStorage.getItem("role")||"user";
 const admin=(u==="devshah"||r==="admin");

 document.querySelectorAll("[data-feature='admin'],#adminBtn,.admin-btn,.admin-nav,.admin-panel").forEach(el=>{
   if(!admin){
      el.remove();
   }
 });

});
