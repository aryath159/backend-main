import jwt from "jsonwebtoken";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.models.js";

const getToken = (req) =>
  req.cookies?.accessToken ||
  req.header("Authorization")?.replace("Bearer ", "");

const findUserFromToken = async (token) => {
  const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
  return User.findById(decodedToken?._id).select("-password -refreshToken");
};

// user MUST be logged in
export const verifyJWT = asyncHandler(async (req, res, next) => {
  const token = getToken(req);

  if (!token) {
    throw new ApiError(401, "Unauthorized request");
  }

  let user;
  try {
    user = await findUserFromToken(token);
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid access token");
  }

  if (!user) {
    throw new ApiError(401, "Invalid access token");
  }

  req.user = user;
  next();
});

// user MAY be logged in: sets req.user when a valid token is present
// and silently carries on as a guest otherwise
export const verifyJWTOptional = asyncHandler(async (req, res, next) => {
  const token = getToken(req);

  if (token) {
    try {
      const user = await findUserFromToken(token);
      if (user) req.user = user;
    } catch {
      // expired / invalid token -> treat as guest
    }
  }

  next();
});
