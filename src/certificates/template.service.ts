import { Injectable, Logger } from '@nestjs/common';

export interface TemplateData {
  name: string;
  eventTitle: string;
  date: string;
  college: string;
  department: string;
  [key: string]: string;
}

@Injectable()
export class TemplateService {
  private readonly logger = new Logger(TemplateService.name);

  /**
   * Default HTML template for certificates
   */
  getDefaultTemplate(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Georgia', serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .certificate {
      background: white;
      width: 900px;
      height: 650px;
      padding: 40px;
      position: relative;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
    }
    .border-outer {
      border: 3px solid #1a365d;
      height: 100%;
      padding: 15px;
    }
    .border-inner {
      border: 1px solid #2c5282;
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 30px;
    }
    .header {
      color: #1a365d;
      font-size: 48px;
      font-weight: bold;
      letter-spacing: 8px;
      margin-bottom: 10px;
    }
    .subheader {
      color: #4a5568;
      font-size: 24px;
      letter-spacing: 4px;
      margin-bottom: 30px;
    }
    .certify-text {
      color: #718096;
      font-size: 16px;
      margin-bottom: 10px;
    }
    .participant-name {
      color: #2d3748;
      font-size: 36px;
      font-weight: bold;
      margin-bottom: 10px;
    }
    .college-info {
      color: #718096;
      font-size: 16px;
      margin-bottom: 20px;
    }
    .participation-text {
      color: #718096;
      font-size: 16px;
      margin-bottom: 10px;
    }
    .event-title {
      color: #2c5282;
      font-size: 30px;
      font-weight: bold;
      margin-bottom: 15px;
    }
    .date-text {
      color: #718096;
      font-size: 16px;
      margin-bottom: 30px;
    }
    .organization {
      color: #1a365d;
      font-size: 20px;
      margin-bottom: 10px;
    }
    .issued-date {
      color: #a0aec0;
      font-size: 12px;
    }
  </style>
</head>
<body>
  <div class="certificate">
    <div class="border-outer">
      <div class="border-inner">
        <div class="header">CERTIFICATE</div>
        <div class="subheader">OF PARTICIPATION</div>
        <div class="certify-text">This is to certify that</div>
        <div class="participant-name">{{name}}</div>
        <div class="college-info">{{college}} - {{department}}</div>
        <div class="participation-text">has successfully participated in</div>
        <div class="event-title">{{eventTitle}}</div>
        <div class="date-text">held on {{date}}</div>
        <div class="organization">The Robotics Club</div>
        <div class="issued-date">Issued on {{issuedDate}}</div>
      </div>
    </div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Parse template and replace placeholders with actual data
   */
  parseTemplate(template: string, data: TemplateData): string {
    let result = template;

    // Add issued date
    const issuedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    const allData: Record<string, string> = {
      ...data,
      issuedDate,
    };

    // Replace all placeholders
    for (const [key, value] of Object.entries(allData)) {
      const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, 'gi');
      result = result.replace(placeholder, value);
    }

    return result;
  }

  /**
   * Validate that template contains required placeholders
   */
  validateTemplate(template: string): {
    valid: boolean;
    missingFields: string[];
  } {
    const requiredFields = ['name', 'eventTitle', 'date'];
    const missingFields: string[] = [];

    for (const field of requiredFields) {
      const placeholder = new RegExp(`{{\\s*${field}\\s*}}`, 'i');
      if (!placeholder.test(template)) {
        missingFields.push(field);
      }
    }

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Extract all placeholders from a template
   */
  extractPlaceholders(template: string): string[] {
    const regex = /{{\s*(\w+)\s*}}/g;
    const placeholders: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(template)) !== null) {
      const placeholder = match[1];
      if (placeholder && !placeholders.includes(placeholder)) {
        placeholders.push(placeholder);
      }
    }

    return placeholders;
  }
}
