import mongoose from "mongoose";

// Connect to MongoDB
async function connectToDatabase() {
  try {
    await mongoose.connect(
      "mongodb+srv://deepakkumar:M92xjniipmDT8rtK@cluster0.z2d9d.mongodb.net/centersect?retryWrites=true&w=majority&appName=Cluster0",
      {
        useNewUrlParser: true,
      }
    );
    console.log("Connected to MongoDB");
  } catch (error) {
    console.error("Error connecting to MongoDB:", error.message);
  }
}

// Define the schema for the extracted data
const DataSchema = new mongoose.Schema({
  tagString: { type: String, required: true },
  title: { type: String, required: true },
  pdfUrl: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
},{versionKey:false});

// Create the model
const scrapData = mongoose.model("report", DataSchema);

export { connectToDatabase, scrapData };
