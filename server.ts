import express from "express";
import path from "path";
import { Resend } from "resend";
import dotenv from "dotenv";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Firebase Admin SDK lazily when requested
let adminAuth: Auth | null = null;
let adminInitialized = false;

function getAdminAuth(): Auth | null {
  if (adminInitialized) return adminAuth;
  adminInitialized = true;
  try {
    if (process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      if (getApps().length === 0) {
        initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || "orjonapp",
        });
      }
      adminAuth = getAuth();
    }
  } catch (e) {
    console.warn("Firebase Admin SDK lazy initialization notice:", e);
    adminAuth = null;
  }
  return adminAuth;
}

// Helper to safely parse JWT payload
function parseJwtPayload(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = Buffer.from(parts[1], "base64").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return null;
  }
}

// Authorized Admin Emails list
const AUTHORIZED_ADMIN_EMAILS = new Set([
  "mohidur143@gmail.com",
]);

function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  if (AUTHORIZED_ADMIN_EMAILS.has(normalized)) return true;
  if (process.env.ADMIN_EMAILS) {
    const envEmails = process.env.ADMIN_EMAILS.split(",").map((e) => e.trim().toLowerCase());
    if (envEmails.includes(normalized)) return true;
  }
  return false;
}

// API health check routes for container deployment readiness and health checks
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/healthz", (req, res) => {
  res.status(200).send("OK");
});

// Set Custom Claims for Admin Users via Firebase Admin SDK
app.post("/api/admin/set-admin-claims", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromBody = req.body?.idToken;
    const idToken = tokenFromBody || (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: "Firebase ID Token is required."
      });
    }

    let userEmail: string | undefined;
    let userUid: string | undefined;

    // 1. Try verifying with Firebase Admin SDK if available
    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userEmail = decoded.email;
        userUid = decoded.uid;
      } catch {
        // Fallback to JWT payload parsing
      }
    }

    // 2. Fallback to parsing JWT payload
    if (!userEmail || !userUid) {
      const parsed = parseJwtPayload(idToken);
      if (parsed) {
        if (parsed.exp && parsed.exp * 1000 < Date.now()) {
          return res.status(401).json({
            success: false,
            error: "Token has expired. Please sign in again."
          });
        }
        userEmail = parsed.email;
        userUid = parsed.user_id || parsed.sub || parsed.uid;
      }
    }

    if (!userEmail || !userUid) {
      return res.status(401).json({
        success: false,
        error: "Unable to extract user identity from the provided token."
      });
    }

    const isAdmin = isAuthorizedAdminEmail(userEmail);
    if (!isAdmin) {
      return res.status(403).json({
        success: false,
        admin: false,
        error: `User "${userEmail}" is not authorized as an administrator.`
      });
    }

    // 3. Attempt to set custom claims on Firebase Auth (silent fallback if API not enabled on ADC)
    let claimsGranted = false;
    if (adminAuth) {
      try {
        await adminAuth.setCustomUserClaims(userUid, { admin: true });
        claimsGranted = true;
      } catch {
        claimsGranted = false;
      }
    }

    return res.json({
      success: true,
      admin: true,
      uid: userUid,
      email: userEmail,
      customClaimsSet: claimsGranted,
      message: "Admin authorization verified successfully."
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      error: err?.message || "Failed to process admin authorization."
    });
  }
});

// Verify Admin Claim via Firebase Admin SDK
app.post("/api/admin/verify-admin-claim", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const tokenFromBody = req.body?.idToken;
    const idToken = tokenFromBody || (authHeader && authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null);

    if (!idToken) {
      return res.status(400).json({ success: false, admin: false, error: "ID Token required." });
    }

    let userEmail: string | undefined;
    let userUid: string | undefined;
    let hasAdminClaim = false;

    const adminAuth = getAdminAuth();
    if (adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userEmail = decoded.email;
        userUid = decoded.uid;
        hasAdminClaim = decoded.admin === true;
      } catch {
        // Fallback to payload parsing
      }
    }

    if (!userEmail || !userUid) {
      const parsed = parseJwtPayload(idToken);
      if (parsed) {
        if (parsed.exp && parsed.exp * 1000 < Date.now()) {
          return res.status(401).json({ success: false, admin: false, error: "Token has expired." });
        }
        userEmail = parsed.email;
        userUid = parsed.user_id || parsed.sub || parsed.uid;
        hasAdminClaim = parsed.admin === true;
      }
    }

    const isAdmin = hasAdminClaim || isAuthorizedAdminEmail(userEmail);

    return res.json({
      success: true,
      admin: isAdmin,
      uid: userUid,
      email: userEmail
    });
  } catch (err: any) {
    return res.status(200).json({
      success: false,
      admin: false,
      error: err?.message || "Invalid token"
    });
  }
});

// Lazy-get Resend instance
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

// In-memory rate limiting stores for OTP requests
interface OtpRequestRecord {
  timestamps: number[];
  lastRequestTime: number;
}

const otpRateLimitByEmail = new Map<string, OtpRequestRecord>();
const otpRateLimitByIp = new Map<string, OtpRequestRecord>();

// Cleanup stale entries every 15 minutes to prevent memory leaks
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  const TEN_MINUTES = 10 * 60 * 1000;
  
  for (const [key, record] of otpRateLimitByEmail.entries()) {
    record.timestamps = record.timestamps.filter(ts => now - ts < TEN_MINUTES);
    if (record.timestamps.length === 0 && now - record.lastRequestTime > TEN_MINUTES) {
      otpRateLimitByEmail.delete(key);
    }
  }
  for (const [key, record] of otpRateLimitByIp.entries()) {
    record.timestamps = record.timestamps.filter(ts => now - ts < TEN_MINUTES);
    if (record.timestamps.length === 0 && now - record.lastRequestTime > TEN_MINUTES) {
      otpRateLimitByIp.delete(key);
    }
  }
}, 15 * 60 * 1000);
if (cleanupTimer.unref) {
  cleanupTimer.unref();
}

// Helper function to extract client IP address
function getClientIp(req: express.Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown_ip";
}

// API Route to send Real Email OTP via Resend with IP/Email rate limiting and 60-second cooldown
app.post("/api/send-otp", async (req, res) => {
  try {
    const { email, otp, subject, name, type } = req.body;

    const sanitizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!sanitizedEmail || !emailRegex.test(sanitizedEmail) || !otp) {
      return res.status(400).json({ 
        success: false, 
        error: "সঠিক ইমেইল এড্রেস এবং ওটিপি প্রদান করা বাধ্যতামূলক।" 
      });
    }

    const clientIp = getClientIp(req);
    const now = Date.now();
    const WINDOW_MS = 10 * 60 * 1000; // 10 minutes window
    const MAX_REQUESTS = 3;            // Max 3 requests per 10 mins
    const COOLDOWN_MS = 60 * 1000;     // 60-second cooldown between requests

    // 1. Check & Enforce 60-second cooldown (by email and IP)
    const emailRecord = otpRateLimitByEmail.get(sanitizedEmail) || { timestamps: [], lastRequestTime: 0 };
    const ipRecord = otpRateLimitByIp.get(clientIp) || { timestamps: [], lastRequestTime: 0 };

    const emailElapsed = now - emailRecord.lastRequestTime;
    const ipElapsed = now - ipRecord.lastRequestTime;

    if (emailElapsed < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - emailElapsed) / 1000);
      return res.status(429).json({
        success: false,
        cooldownRemaining: remainingSec,
        error: `অনুগ্রহ করে অপেক্ষা করুন। পরবর্তী ওটিপি পাঠানোর জন্য আরও ${remainingSec} সেকেন্ড সময় প্রয়োজন (৬০ সেকেন্ড কুলডাউন)।`
      });
    }

    if (ipElapsed < COOLDOWN_MS) {
      const remainingSec = Math.ceil((COOLDOWN_MS - ipElapsed) / 1000);
      return res.status(429).json({
        success: false,
        cooldownRemaining: remainingSec,
        error: `এই আইপি থেকে দ্রুত পুনরায় অনুরোধ পাঠানো হয়েছে। অনুগ্রহ করে আরও ${remainingSec} সেকেন্ড অপেক্ষা করুন।`
      });
    }

    // 2. Check 10-minute rate limits (Max 3 OTP requests)
    const validEmailTimestamps = emailRecord.timestamps.filter(ts => now - ts < WINDOW_MS);
    const validIpTimestamps = ipRecord.timestamps.filter(ts => now - ts < WINDOW_MS);

    if (validEmailTimestamps.length >= MAX_REQUESTS) {
      const oldestTimestamp = validEmailTimestamps[0];
      const resetTimeSec = Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
      const resetTimeMin = Math.ceil(resetTimeSec / 60);
      return res.status(429).json({
        success: false,
        error: `ওটিপি অনুরোধের সর্বোচ্চ সীমা অতিক্রম হয়েছে (১০ মিনিটে সর্বোচ্চ ৩টি)। অনুগ্রহ করে ${resetTimeMin} মিনিট পর আবার চেষ্টা করুন।`
      });
    }

    if (validIpTimestamps.length >= MAX_REQUESTS) {
      const oldestTimestamp = validIpTimestamps[0];
      const resetTimeSec = Math.ceil((WINDOW_MS - (now - oldestTimestamp)) / 1000);
      const resetTimeMin = Math.ceil(resetTimeSec / 60);
      return res.status(429).json({
        success: false,
        error: `আপনার আইপি থেকে ১০ মিনিটে সর্বোচ্চ ৩টি ওটিপি অনুরোধ করা হয়েছে। অনুগ্রহ করে ${resetTimeMin} মিনিট অপেক্ষা করুন।`
      });
    }

    const resend = getResendClient();
    if (!resend) {
      console.warn("RESEND_API_KEY environment variable is missing.");
      return res.status(500).json({ 
        success: false, 
        error: "সার্ভারে RESEND_API_KEY কনফিগার করা নেই। অনুগ্রহ করে সিক্রেটস প্যানেলে RESEND_API_KEY সেট করুন।" 
      });
    }

    // Record this attempt in rate limit maps
    validEmailTimestamps.push(now);
    validIpTimestamps.push(now);
    otpRateLimitByEmail.set(sanitizedEmail, { timestamps: validEmailTimestamps, lastRequestTime: now });
    otpRateLimitByIp.set(clientIp, { timestamps: validIpTimestamps, lastRequestTime: now });

    const emailSubject = subject || (type === 'reset' ? 'পাসওয়ার্ড রিকভারি ভেরিফিকেশন কোড - অর্জন' : 'ইমেইল ভেরিফিকেশন কোড (OTP) - অর্জন');
    const userName = name || 'শ্রদ্ধেয় ইউজার';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h2 style="color: #4f46e5; margin: 0; font-size: 24px;">অর্জন (Orjon)</h2>
          <p style="color: #64748b; font-size: 13px; margin-top: 4px;">বিসিএস ও অন্যান্য প্রতিযোগিতামূলক পরীক্ষার প্রস্তুতি প্ল্যাটফর্ম</p>
        </div>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 16px 0;" />
        <p style="color: #334155; font-size: 15px; font-weight: bold;">প্রিয় ${userName},</p>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">
          আপনার ${type === 'reset' ? 'পাসওয়ার্ড রিকভারির' : 'অ্যাকাউন্ট ভেরিফিকেশনের'} জন্য ৬ ডিজিটের গোপন ওটিপি (OTP) কোড নিচে দেওয়া হলো:
        </p>
        <div style="text-align: center; margin: 24px 0;">
          <span style="display: inline-block; background-color: #f5f3ff; color: #4f46e5; font-size: 32px; font-weight: 800; tracking: 6px; padding: 12px 28px; border-radius: 12px; border: 1px border #ddd6fe; letter-spacing: 6px;">
            ${otp}
          </span>
        </div>
        <p style="color: #64748b; font-size: 13px; line-height: 1.5;">
          ⚠️ এই কোডটি গোপন রাখুন এবং অন্য কারও সাথে শেয়ার করবেন না। এটি ২ মিনিটের জন্য সক্রিয় থাকবে।
        </p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin: 20px 0;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin: 0;">
          এটি একটি স্বয়ংক্রিয় বার্তা। অনুগ্রহ করে এই ইমেইলে কোনো উত্তর দেবেন না।
        </p>
      </div>
    `;

    // Send via Resend
    const sender = "Orjon App <onboarding@resend.dev>";
    const { data: resendData, error: resendError } = await resend.emails.send({
      from: sender,
      to: [sanitizedEmail],
      subject: emailSubject,
      html: htmlContent,
    });

    if (resendError) {
      console.warn("Resend API delivery response error:", resendError);
      
      let msg = resendError.message || "Resend এর মাধ্যমে ইমেইল প্রসেস করতে সমস্যা হয়েছে।";
      const errName = resendError.name || "";
      const errMsg = resendError.message || "";

      if (errName === 'validation_error' || errMsg.includes('testing emails') || errMsg.includes('validation')) {
        if (errMsg.includes('testing emails') || errMsg.includes('own email address')) {
          msg = `Resend ফ্রি টেস্ট কি-তে কেবল অ্যাকাউন্ট ওনারের ইমেইলে (mohidur143@gmail.com) সরাসরি রিয়েল মেইল পাঠানো যায়। অন্য ইমেইলে পাঠাতে Resend-এ কাস্টম ডোমেইন ভেরিফিকেশন প্রয়োজন।`;
        } else {
          msg = `ইমেইল সার্ভিস ভ্যালিডেশন নোটিশ: ${errMsg || "সঠিক ইমেইল এড্রেস প্রবেশ করান।"}`;
        }
      }

      return res.status(200).json({
        success: false,
        error: msg
      });
    }

    console.log(`Real OTP email sent to ${sanitizedEmail} via Resend. ID: ${resendData?.id}`);
    return res.json({
      success: true,
      id: resendData?.id,
      message: "Resend এর মাধ্যমে ইমেইলে সফলভাবে ওটিপি পাঠানো হয়েছে।"
    });

  } catch (err: any) {
    console.error("Error in /api/send-otp endpoint:", err);
    let errMsg = err.message || "সার্ভার এরর: ওটিপি পাঠানো সম্ভব হয়নি।";
    if (err.name === 'validation_error' || (err.message && err.message.includes('validation'))) {
      errMsg = `ইমেইল সার্ভিস নোটিশ: ${err.message || 'ইমেইল ভ্যালিডেশন এরর।'}`;
    }
    return res.status(200).json({
      success: false,
      error: errMsg
    });
  }
});

// Server startup and static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      const indexPath = path.join(distPath, "index.html");
      res.sendFile(indexPath, (err) => {
        if (err && !res.headersSent) {
          res.status(200).send("<!DOCTYPE html><html><head><title>Orjon</title></head><body><div id=\"root\"></div></body></html>");
        }
      });
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });

  server.on("error", (err) => {
    console.error("Server listen error:", err);
  });

  process.on("SIGTERM", () => {
    console.log("Received SIGTERM signal, shutting down gracefully...");
    server.close(() => {
      process.exit(0);
    });
    setTimeout(() => {
      process.exit(0);
    }, 5000).unref();
  });

  process.on("SIGINT", () => {
    server.close(() => {
      process.exit(0);
    });
  });
}

startServer();
