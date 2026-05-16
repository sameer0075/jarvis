const mongoose = require("mongoose");

const FileIndexSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      index: true,
    },

    lowerName: {
      type: String,
      index: true,
    },

    path: {
      type: String,
      unique: true,
      index: true,
    },

    extension: {
      type: String,
      index: true,
    },

    directory: {
      type: String,
      index: true,
    },

    size: Number,

    mime: String,

    modifiedAt: {
      type: Date,
      index: true,
    },

    createdAtFs: Date,

    isDirectory: {
      type: Boolean,
      default: false,
      index: true,
    },

    tokens: [String],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("FileIndex", FileIndexSchema);