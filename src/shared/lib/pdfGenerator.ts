import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { Routine, Question, CategoryItem, SubcategoryItem, formatBengaliDateTime } from '../types';
import { formatRoutineSyllabusPaths } from './routineUtils';

export const downloadCourseRoutinePDF = async (
  courseTitle: string,
  courseCategory: string | undefined,
  routines: Routine[],
  subcategories?: SubcategoryItem[],
  categories?: CategoryItem[],
  questions?: Question[]
): Promise<void> => {
  // Create a temporary container element for rendering the PDF layout
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.top = '-9999px';
  container.style.left = '-9999px';
  container.style.width = '800px';
  container.style.backgroundColor = '#ffffff';
  container.style.color = '#0f172a';
  container.style.fontFamily = "'Noto Sans Bengali', 'Hind Siliguri', sans-serif, system-ui";
  container.style.padding = '40px';
  container.style.boxSizing = 'border-box';

  const dateNowStr = formatBengaliDateTime(new Date().toISOString());

  // Build HTML Content
  container.innerHTML = `
    <div style="font-family: sans-serif; color: #1e293b; line-height: 1.5;">
      <!-- Header Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #3730a3; padding-bottom: 16px; margin-bottom: 24px;">
        <div>
          <h1 style="font-size: 24px; font-weight: 900; color: #312e81; margin: 0; padding: 0;">
            🎓 অর্জন অ্যাডমিশন ও জব সলিউশন
          </h1>
          <p style="font-size: 13px; font-weight: 700; color: #4338ca; margin: 4px 0 0 0;">
            অফিশিয়াল একাডেমিক ও এক্সাম কোর্স রুটিন
          </p>
        </div>
        <div style="text-align: right;">
          <span style="font-size: 11px; font-weight: 700; background-color: #e0e7ff; color: #3730a3; padding: 4px 10px; border-radius: 8px; display: inline-block;">
            ডাউনলোডের তারিখ: ${dateNowStr}
          </span>
        </div>
      </div>

      <!-- Course Info Section -->
      <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
        <h2 style="font-size: 18px; font-weight: 800; color: #0f172a; margin: 0 0 6px 0;">
          কোর্স: ${courseTitle}
        </h2>
        ${courseCategory ? `<p style="font-size: 12px; font-weight: 700; color: #64748b; margin: 0;">ক্যাটাগরি: ${courseCategory}</p>` : ''}
        <p style="font-size: 12px; font-weight: 700; color: #334155; margin: 4px 0 0 0;">
          মোট প্রকাশিত রুটিন ও এক্সাম সেশন: ${routines.length} টি
        </p>
      </div>

      <!-- Routines Table -->
      <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
        <thead>
          <tr style="background-color: #312e81; color: #ffffff; font-weight: 800;">
            <th style="padding: 10px 12px; border: 1px solid #312e81; width: 40px; text-align: center;">#</th>
            <th style="padding: 10px 12px; border: 1px solid #312e81; width: 140px;">তারিখ ও সময়</th>
            <th style="padding: 10px 12px; border: 1px solid #312e81;">রুটিন শিরোনাম ও বিস্তারিত বিবরণ</th>
            <th style="padding: 10px 12px; border: 1px solid #312e81; width: 220px;">পরীক্ষা ও সিলেবাস বিষয়সূচী</th>
          </tr>
        </thead>
        <tbody>
          ${routines.map((r, idx) => {
            const hasExam = r.examConfig && r.examConfig.enabled;
            const examTime = hasExam && r.examConfig?.startTime 
              ? formatBengaliDateTime(r.examConfig.startTime) 
              : (r.examDate ? formatBengaliDateTime(r.examDate) : formatBengaliDateTime(r.createdAt));

            const syllabusPaths = formatRoutineSyllabusPaths(r, subcategories, categories, questions);

            return `
              <tr style="background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'}; border: 1px solid #cbd5e1;">
                <td style="padding: 10px 12px; border: 1px solid #cbd5e1; text-align: center; font-weight: 800; color: #3730a3;">
                  ${(idx + 1).toLocaleString('bn-BD')}
                </td>
                <td style="padding: 10px 12px; border: 1px solid #cbd5e1; font-weight: 700; color: #1e293b;">
                  ${examTime}
                </td>
                <td style="padding: 10px 12px; border: 1px solid #cbd5e1;">
                  <strong style="font-size: 13px; color: #1e1b4b; display: block; margin-bottom: 4px;">
                    ${r.title}
                  </strong>
                  <div style="font-size: 11px; color: #475569; white-space: pre-line; line-height: 1.4;">
                    ${r.details || ''}
                  </div>
                </td>
                <td style="padding: 10px 12px; border: 1px solid #cbd5e1;">
                  ${hasExam ? `
                    <div style="background-color: #e0e7ff; color: #312e81; font-weight: 800; padding: 4px 8px; border-radius: 6px; font-size: 10px; margin-bottom: 6px; display: inline-block;">
                      ⏱️ পরীক্ষার মান: ${r.examConfig?.qLimit || 20} MCQ | সময়: ${r.examConfig?.timeLimit || 20} মিনিট | পূর্ণমান: ${r.examConfig?.totalMarks || 20} | পাস mark: ${r.examConfig?.passMarks || 8}
                    </div>
                  ` : '<div style="color: #64748b; font-size: 10px; font-weight: 600;">পড়া ও রিভিশন ক্লাস</div>'}

                  ${syllabusPaths.length > 0 ? `
                    <div style="margin-top: 4px;">
                      <strong style="font-size: 10px; color: #334155; display: block; margin-bottom: 3px;">📚 সিলেবাস শাখা (Syllabus Hierarchy):</strong>
                      <div style="display: flex; flex-direction: column; gap: 3px;">
                        ${syllabusPaths.map(p => `<span style="background-color: #f1f5f9; color: #1e1b4b; border: 1px solid #cbd5e1; padding: 3px 6px; border-radius: 4px; font-size: 9.5px; font-weight: 700;">📌 ${p}</span>`).join('')}
                      </div>
                    </div>
                  ` : ''}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>

      <!-- Footer Branding -->
      <div style="margin-top: 32px; border-top: 1px solid #e2e8f0; padding-top: 12px; text-align: center; font-size: 11px; color: #64748b; font-weight: 600;">
        প্রস্তুত করেছে: অর্জনের ডিজিটাল লার্নিং প্ল্যাটফর্ম • বিসিএস, এনটিআরসিএ, প্রাইমারি ও ব্যাংকিং জব সলিউশন
      </div>
    </div>
  `;

  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({
      orientation: 'p',
      unit: 'mm',
      format: 'a4'
    });

    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    const sanitizedTitle = courseTitle.replace(/[^a-zA-Z0-9\u0980-\u09FF]/g, '_');
    pdf.save(`Routine_${sanitizedTitle}.pdf`);
  } catch (err) {
    console.error('Failed to generate PDF:', err);
    alert('PDF তৈরিতে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।');
  } finally {
    document.body.removeChild(container);
  }
};
