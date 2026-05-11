const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Joi = require("joi");

const userSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["admin", "billing"],
      required: true,
    },
    company: { type: String, trim: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },
  },
  { timestamps: true },
);

userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

const passwordRules = Joi.string()
  .min(6)
  .max(64)
  .pattern(/^(?=.*[a-zA-Z])(?=.*\d)/)
  .messages({
    "string.min": "Password must be at least 6 characters",
    "string.max": "Password cannot exceed 64 characters",
    "string.pattern.base":
      "Password must contain at least one letter and one number",
  });

const registerSchema = Joi.object({
  firstName: Joi.string().trim().min(2).max(50).required().messages({
    "string.min": "First name must be at least 2 characters",
    "any.required": "First name is required",
  }),
  lastName: Joi.string().trim().min(2).max(50).required().messages({
    "string.min": "Last name must be at least 2 characters",
    "any.required": "Last name is required",
  }),
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: passwordRules.required().messages({
    "any.required": "Password is required",
  }),
  confirmPassword: Joi.any()
    .valid(Joi.ref("password"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
  role: Joi.string().valid("admin", "billing").required().messages({
    "any.only": "Role must be admin or billing",
    "any.required": "Role is required",
  }),
  company: Joi.when("role", {
    is: "admin",
    then: Joi.string().trim().min(2).max(100).required().messages({
      "any.required": "Company name is required for admin accounts",
    }),
    otherwise: Joi.string().trim().max(100).optional(),
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().email().lowercase().required().messages({
    "string.email": "Please provide a valid email address",
    "any.required": "Email is required",
  }),
  password: Joi.string().required().messages({
    "any.required": "Password is required",
  }),
  role: Joi.string().valid("admin", "billing").required().messages({
    "any.only": "Role must be admin or billing",
    "any.required": "Role is required",
  }),
});

const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required().messages({
    "any.required": "Current password is required",
  }),
  newPassword: passwordRules.required().messages({
    "any.required": "New password is required",
  }),
  confirmNewPassword: Joi.any()
    .valid(Joi.ref("newPassword"))
    .required()
    .messages({ "any.only": "Passwords do not match" }),
});

const userModel = mongoose.model("User", userSchema);

module.exports = {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  userModel,
};
