import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-get Resend instance
function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Resend(apiKey);
}

// API Route to send Real Email OTP via Resend
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

    const resend = getResendClient();
    if (!resend) {
      console.warn("RESEND_API_KEY environment variable is missing.");
      return res.status(500).json({ 
        success: false, 
        error: "সার্ভারে RESEND_API_KEY কনফিগার করা নেই। অনুগ্রহ করে সিক্রেটস প্যানেলে RESEND_API_KEY সেট করুন।" 
      });
    }

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

// Vite middleware setup for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
