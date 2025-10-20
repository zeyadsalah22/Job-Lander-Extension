/**
 * Intelligent Job Data Extractor
 * 
 * Uses a cascading fallback strategy to extract job posting data:
 * 1. JSON-LD structured data (schema.org/JobPosting)
 * 2. Meta tags (OpenGraph, Twitter Cards)
 * 3. Smart DOM analysis (content scoring + semantic patterns)
 * 4. Site-specific patterns (Greenhouse, Lever, Workday, etc.)
 */

class JobDataExtractor {
  constructor() {
    this.url = window.location.href;
    this.hostname = window.location.hostname.toLowerCase();
  }

  /**
   * Main extraction method - tries all strategies in priority order
   */
  async extract() {
    console.log('Job Lander: Starting intelligent job data extraction...');

    // Strategy 1: Try JSON-LD structured data (most reliable)
    const fromJSONLD = this.extractFromJSONLD();
    if (fromJSONLD && this.isComplete(fromJSONLD, 0.7)) {
      console.log('Job Lander: Extracted from JSON-LD', fromJSONLD);
      return this.normalize(fromJSONLD);
    }

    // Strategy 2: Try meta tags
    const fromMeta = this.extractFromMetaTags();
    
    // Strategy 3: Try site-specific patterns (ATS systems)
    const fromSiteSpecific = this.extractFromSiteSpecific();
    
    // Strategy 4: Smart DOM analysis (universal fallback)
    const fromDOM = this.extractFromDOM();

    // Merge all sources, prioritizing more reliable ones
    const merged = this.mergeData([
      fromJSONLD,
      fromSiteSpecific,
      fromMeta,
      fromDOM
    ]);

    console.log('Job Lander: Final extracted data', merged);
    return this.normalize(merged);
  }

  /**
   * Extract from JSON-LD structured data
   */
  extractFromJSONLD() {
    const getJSON = (text) => {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    };

    // Find all JSON-LD scripts
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    const allJobPostings = [];

    scripts.forEach(script => {
      const data = getJSON(script.textContent);
      if (!data) return;

      // Walk through the data structure to find JobPosting objects
      const walk = (obj) => {
        if (!obj || typeof obj !== 'object') return;

        if (Array.isArray(obj)) {
          obj.forEach(walk);
        } else {
          // Safely get type as string
          let typeValue = obj['@type'] || obj['type'] || '';
          if (typeof typeValue !== 'string') {
            typeValue = String(typeValue);
          }
          const type = typeValue.toLowerCase();
          
          if (type.includes('jobposting')) {
            allJobPostings.push(obj);
          }
          // Continue walking nested objects
          Object.values(obj).forEach(walk);
        }
      };

      walk(data);
    });

    if (allJobPostings.length === 0) {
      console.log('Job Lander: No JSON-LD JobPosting found');
      return null;
    }

    // Use the first JobPosting found
    const job = allJobPostings[0];
    console.log('Job Lander: Found JSON-LD JobPosting', job);

    return {
      jobTitle: job.title || job.name || '',
      companyName: this.extractCompanyFromLD(job.hiringOrganization),
      location: this.extractLocationFromLD(job.jobLocation),
      jobDescription: this.cleanText(job.description || ''),
      salary: this.extractSalaryFromLD(job.baseSalary),
      jobType: job.employmentType || '',
      datePosted: job.datePosted || '',
      validThrough: job.validThrough || ''
    };
  }

  extractCompanyFromLD(org) {
    if (!org) return '';
    if (typeof org === 'string') return org;
    return org.name || org['@name'] || '';
  }

  extractLocationFromLD(loc) {
    if (!loc) return '';
    if (typeof loc === 'string') return loc;
    if (Array.isArray(loc)) loc = loc[0];
    
    const address = loc.address || {};
    const parts = [
      address.addressLocality,
      address.addressRegion,
      address.addressCountry
    ].filter(Boolean);
    
    return parts.join(', ') || loc.name || '';
  }

  extractSalaryFromLD(salary) {
    if (!salary) return '';
    if (typeof salary === 'string') return salary;
    
    const currency = salary.currency || '$';
    const value = salary.value;
    const minValue = salary.minValue;
    const maxValue = salary.maxValue;
    const unitText = salary.unitText || '';

    if (minValue && maxValue) {
      return `${currency}${minValue}-${maxValue} ${unitText}`.trim();
    }
    if (value) {
      return `${currency}${value} ${unitText}`.trim();
    }
    return '';
  }

  /**
   * Extract from meta tags (OpenGraph, Twitter Cards)
   */
  extractFromMetaTags() {
    const meta = (name) => {
      const el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`);
      return el?.getAttribute('content')?.trim() || '';
    };

    const title = meta('og:title') || meta('twitter:title') || '';
    const description = meta('og:description') || meta('twitter:description') || '';
    const company = meta('og:site_name') || '';

    if (!title && !description) {
      console.log('Job Lander: No useful meta tags found');
      return null;
    }

    console.log('Job Lander: Extracted from meta tags', { title, company, description: description.substring(0, 100) });

    return {
      jobTitle: title,
      companyName: company,
      jobDescription: this.cleanText(description),
      location: '',
      salary: '',
      jobType: ''
    };
  }

  /**
   * Extract from site-specific patterns (ATS systems)
   */
  extractFromSiteSpecific() {
    // WhiteCarrot
    if (this.hostname.includes('whitecarrot.io')) {
      return this.extractFromWhiteCarrot();
    }

    // Greenhouse
    if (this.hostname.includes('greenhouse.io') || document.querySelector('#grnhse_app')) {
      return this.extractFromGreenhouse();
    }

    // Lever
    if (this.hostname.includes('lever.co') || document.querySelector('.posting')) {
      return this.extractFromLever();
    }

    // Workday
    if (this.hostname.includes('myworkdayjobs.com') || document.querySelector('[data-automation-id="jobPostingHeader"]')) {
      return this.extractFromWorkday();
    }

    // SmartRecruiters
    if (this.hostname.includes('smartrecruiters.com') || document.querySelector('[data-test="job-title"]')) {
      return this.extractFromSmartRecruiters();
    }

    // LinkedIn
    if (this.hostname.includes('linkedin.com')) {
      return this.extractFromLinkedIn();
    }

    // Indeed
    if (this.hostname.includes('indeed.com')) {
      return this.extractFromIndeed();
    }

    // Glassdoor
    if (this.hostname.includes('glassdoor.com')) {
      return this.extractFromGlassdoor();
    }

    return null;
  }

  extractFromWhiteCarrot() {
    console.log('Job Lander: Using WhiteCarrot-specific extraction');
    
    // WhiteCarrot is a Vue.js SPA - wait for content to load
    const maxAttempts = 10;
    let attempts = 0;
    
    const extractData = () => {
      // Job title - look for centered large text
      const jobTitle = this.getTextContent('.mt-3.mb-2.text-center') || 
                       Array.from(document.querySelectorAll('p')).find(p => 
                         p.style.fontSize === '1.75rem' && p.textContent.trim()
                       )?.textContent.trim() || '';
      
      // Company name - extract from URL (e.g., /careers/bayzat/job/)
      let companyName = '';
      const urlMatch = window.location.pathname.match(/\/careers\/([^\/]+)\//);
      if (urlMatch) {
        companyName = urlMatch[1].charAt(0).toUpperCase() + urlMatch[1].slice(1);
      }
      
      // Also check for company logo alt text
      const logo = document.querySelector('img[alt="Logo"]');
      if (logo && logo.src && !companyName) {
        // Try to extract from image filename
        const srcMatch = logo.src.match(/\/([^\/]+)\.\w+$/);
        if (srcMatch) {
          companyName = srcMatch[1];
        }
      }
      
      // Job description link - extract the external job description URL
      const jobDescLink = document.querySelector('a[href*="/share/careers/"]');
      let jobDescription = '';
      let externalUrl = '';
      
      if (jobDescLink) {
        externalUrl = jobDescLink.href;
        jobDescription = `For full job description, visit: ${externalUrl}`;
      }
      
      // Location - WhiteCarrot often doesn't show location on profile-builder page
      // Try to find any location-related text
      let location = '';
      const textElements = Array.from(document.querySelectorAll('p, span, div'));
      for (const el of textElements) {
        const text = el.textContent.trim();
        // Look for common location patterns
        if (text.match(/^[A-Z][a-z]+,\s*[A-Z]/)) { // City, Country pattern
          location = text;
          break;
        }
      }
      
      return {
        jobTitle: jobTitle,
        companyName: companyName,
        location: location,
        jobDescription: jobDescription,
        salary: '',
        jobType: ''
      };
    };
    
    const data = extractData();
    
    // If data is incomplete and we haven't exceeded attempts, wait and retry
    if ((!data.jobTitle || !data.companyName) && attempts < maxAttempts) {
      attempts++;
      console.log('Job Lander: WhiteCarrot data incomplete, waiting for Vue to render...', attempts);
      setTimeout(() => extractData(), 500);
    }
    
    return data;
  }

  extractFromGreenhouse() {
    console.log('Job Lander: Using Greenhouse-specific extraction');
    return {
      jobTitle: this.getTextContent('#header .app-title'),
      companyName: this.getTextContent('#header .company-name'),
      location: this.getTextContent('.location'),
      jobDescription: this.getHTMLContent('#content'),
      salary: '',
      jobType: ''
    };
  }

  extractFromLever() {
    console.log('Job Lander: Using Lever-specific extraction');
    const categories = document.querySelector('.posting-categories');
    return {
      jobTitle: this.getTextContent('.posting-headline h2'),
      companyName: document.querySelector('.main-header-logo')?.alt || '',
      location: this.getTextContent('.posting-categories .location'),
      jobDescription: this.getHTMLContent('.section-wrapper .content'),
      salary: '',
      jobType: this.getTextContent('.posting-categories .commitment')
    };
  }

  extractFromWorkday() {
    console.log('Job Lander: Using Workday-specific extraction');
    return {
      jobTitle: this.getTextContent('[data-automation-id="jobPostingHeader"]'),
      companyName: this.getTextContent('.company-name, [data-automation-id="companyName"]'),
      location: this.getTextContent('[data-automation-id="locations"]'),
      jobDescription: this.getHTMLContent('[data-automation-id="jobPostingDescription"]'),
      salary: '',
      jobType: this.getTextContent('[data-automation-id="time-type"]')
    };
  }

  extractFromSmartRecruiters() {
    console.log('Job Lander: Using SmartRecruiters-specific extraction');
    return {
      jobTitle: this.getTextContent('[data-test="job-title"]'),
      companyName: this.getTextContent('[data-test="company-name"]'),
      location: this.getTextContent('[data-test="job-location"]'),
      jobDescription: this.getHTMLContent('[data-test="job-description"]'),
      salary: '',
      jobType: this.getTextContent('[data-test="employment-type"]')
    };
  }

  extractFromLinkedIn() {
    console.log('Job Lander: Using LinkedIn-specific extraction');
    const titleSelectors = [
      '.jobs-unified-top-card__job-title h1',
      '.jobs-unified-top-card__job-title a',
      '.job-details-jobs-unified-top-card__job-title h1',
      'h1.t-24.t-bold'
    ];

    const companySelectors = [
      '.jobs-unified-top-card__company-name a',
      '.jobs-unified-top-card__company-name',
      '.job-details-jobs-unified-top-card__company-name a'
    ];

    const descriptionSelectors = [
      '.jobs-description-content__text',
      '.jobs-description__content',
      '.jobs-box__html-content'
    ];

    // Extract location with smart parsing for new LinkedIn structure
    const location = this.extractLinkedInLocation();

    return {
      jobTitle: this.getTextFromSelectors(titleSelectors),
      companyName: this.getTextFromSelectors(companySelectors),
      location: location,
      jobDescription: this.getHTMLFromSelectors(descriptionSelectors),
      salary: '',
      jobType: ''
    };
  }

  extractLinkedInLocation() {
    // Try new LinkedIn structure (2024+) with tvm__text classes
    const tvmTextElements = document.querySelectorAll('.tvm__text--low-emphasis');
    if (tvmTextElements.length > 0) {
      // First tvm__text element is typically the location
      // Format: "Cairo, Cairo, Egypt"
      for (const element of tvmTextElements) {
        const text = element.textContent?.trim() || '';
        // Location typically has commas and doesn't contain numbers or "ago"
        if (text && 
            text.includes(',') && 
            !text.includes('ago') && 
            !text.includes('applicant') && 
            !/\d/.test(text)) {
          console.log('Job Lander: Found location in tvm__text:', text);
          return text;
        }
      }
    }

    // Fallback to older LinkedIn selectors
    const oldLocationSelectors = [
      '.jobs-unified-top-card__bullet',
      '.jobs-unified-top-card__primary-description',
      '.jobs-unified-top-card__subtitle-primary-grouping .tvm__text'
    ];

    for (const selector of oldLocationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent?.trim() || '';
        if (text) {
          console.log('Job Lander: Found location in old selector:', text);
          return text;
        }
      }
    }

    console.log('Job Lander: No location found');
    return '';
  }

  extractFromIndeed() {
    console.log('Job Lander: Using Indeed-specific extraction');
    const titleSelectors = [
      '[data-jk] h1 span',
      '[data-jk] h1',
      'h1[data-testid="job-title"]'
    ];

    const companySelectors = [
      '[data-testid="company-name"] a',
      '[data-testid="company-name"]',
      '.jobsearch-CompanyInfoWithoutHeaderImage a'
    ];

    const descriptionSelectors = [
      '#jobDescriptionText',
      '[data-testid="jobDescription"]'
    ];

    return {
      jobTitle: this.getTextFromSelectors(titleSelectors),
      companyName: this.getTextFromSelectors(companySelectors),
      location: this.getTextContent('[data-testid="job-location"]'),
      jobDescription: this.getHTMLFromSelectors(descriptionSelectors),
      salary: this.getTextContent('[data-testid="salary-snippet"]'),
      jobType: ''
    };
  }

  extractFromGlassdoor() {
    console.log('Job Lander: Using Glassdoor-specific extraction');
    
    // Glassdoor has a two-column layout: job list (left) and job details (right)
    // We need to extract from the job details panel, not the list
    const jobDetailsContainer = document.querySelector('.JobDetails_jobDetailsContainer__y9P3L') ||
                                document.querySelector('[class*="JobDetails_jobDetails"]') ||
                                document.querySelector('.jobDetails') ||
                                document.querySelector('#JobDetails');
    
    // Helper function to search within job details container
    const getTextFromContainer = (selectors) => {
      if (!jobDetailsContainer) {
        return this.getTextFromSelectors(selectors);
      }
      
      for (const selector of selectors) {
        const element = jobDetailsContainer.querySelector(selector);
        if (element) {
          const text = element.textContent?.trim() || '';
          if (text) {
            console.log(`Job Lander: Found match for selector "${selector}":`, text.substring(0, 100));
            return text;
          }
        }
      }
      return '';
    };
    
    const getHTMLFromContainer = (selectors) => {
      if (!jobDetailsContainer) {
        return this.getHTMLFromSelectors(selectors);
      }
      
      for (const selector of selectors) {
        const element = jobDetailsContainer.querySelector(selector);
        if (element) {
          const html = element.innerHTML?.trim() || '';
          if (html) {
            console.log(`Job Lander: Found HTML match for selector "${selector}": ${html.length} chars`);
            return html;
          }
        }
      }
      return '';
    };
    
    // Job title - try multiple selectors (within job details)
    const titleSelectors = [
      'h1[id*="jd-job-title"]',
      '[data-test="job-title"]',
      'h1.heading_Level1__w42c9',
      'h1.heading_Heading__aomVx',
      'div.JobDetails_jobTitle h1',
      'h1'
    ];
    
    // Company name - try multiple selectors (within job details)
    const companySelectors = [
      '.EmployerProfile_employerNameHeading__bXBYr h4',
      'h4.heading_Subhead__jiUbT',
      '.EmployerProfile_compactEmployerName__9MGcV',
      '[data-test="employer-name"]',
      'div[class*="EmployerProfile"] h4',
      'a[class*="EmployerProfile"] h4',
      'div.employerName'
    ];
    
    // Location - try multiple selectors (within job details)
    const locationSelectors = [
      '.JobDetails_locationAndPay__XGFmY > div:first-child',
      'div[data-test="location"]',
      '[data-test="location"]',
      'div[class*="location"]'
    ];
    
    // Job description - try multiple selectors (within job details)
    const descriptionSelectors = [
      '.JobDetails_jobDescription__uW_fK',
      'div[class*="JobDetails_jobDescription"]',
      '[data-test="jobDescriptionContent"]',
      'div.jobDescriptionContent',
      'div.desc',
      'section[class*="description"]'
    ];
    
    // Salary - try multiple selectors (within job details)
    const salarySelectors = [
      'div[id*="jd-salary"]',
      '.JobDetails_locationAndPay__XGFmY .JobCard_salaryEstimate__QpbTW',
      '[data-test="detailSalary"]',
      'div[class*="salary"]'
    ];
    
    console.log('Job Lander: Job details container found:', !!jobDetailsContainer);
    
    const jobTitle = getTextFromContainer(titleSelectors);
    const companyName = getTextFromContainer(companySelectors);
    const location = getTextFromContainer(locationSelectors);
    const jobDescription = getHTMLFromContainer(descriptionSelectors);
    const salary = getTextFromContainer(salarySelectors);
    
    console.log('Job Lander: Glassdoor extraction results:', {
      jobTitle: jobTitle ? `Found: ${jobTitle.substring(0, 50)}...` : 'Not found',
      companyName: companyName ? `Found: ${companyName}` : 'Not found',
      location: location ? `Found: ${location}` : 'Not found',
      jobDescription: jobDescription ? `Found (${jobDescription.length} chars)` : 'Not found',
      salary: salary ? `Found: ${salary}` : 'Not found'
    });
    
    return {
      jobTitle: jobTitle,
      companyName: companyName,
      location: location,
      jobDescription: jobDescription,
      salary: salary,
      jobType: ''
    };
  }

  /**
   * Smart DOM analysis - universal fallback
   */
  extractFromDOM() {
    console.log('Job Lander: Using smart DOM analysis');

    return {
      jobTitle: this.findBiggestHeading(),
      companyName: this.guessCompany(),
      location: this.guessLocation(),
      jobDescription: this.findJobDescription(),
      salary: this.guessSalary(),
      jobType: this.guessJobType()
    };
  }

  findBiggestHeading() {
    const headings = Array.from(document.querySelectorAll('h1, h2'))
      .filter(h => h.offsetParent !== null) // visible only
      .map(h => ({
        element: h,
        size: parseFloat(getComputedStyle(h).fontSize) || 0,
        text: h.innerText?.trim() || ''
      }))
      .filter(h => h.text.length > 0)
      .sort((a, b) => b.size - a.size);

    return headings[0]?.text || document.title.split(' - ')[0] || '';
  }

  guessCompany() {
    // Try common company name patterns
    const selectors = [
      '[data-company-name]',
      '[data-test="employer-name"]',
      '[itemprop="hiringOrganization"]',
      '.company-name',
      '.employer-name',
      '.organization-name'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length < 100) return text;
      }
    }

    // Try extracting from domain ONLY if it's not a job board
    const hostname = window.location.hostname;
    const jobBoards = [
      'linkedin.com',
      'indeed.com',
      'glassdoor.com',
      'monster.com',
      'ziprecruiter.com',
      'careerbuilder.com',
      'simplyhired.com',
      'greenhouse.io',
      'lever.co',
      'workday.com',
      'myworkdayjobs.com',
      'smartrecruiters.com',
      'whitecarrot.io'
    ];
    
    const isJobBoard = jobBoards.some(board => hostname.includes(board));
    
    if (!isJobBoard) {
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        const domain = parts[parts.length - 2];
        // Capitalize first letter
        return domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }

    return '';
  }

  guessLocation() {
    const selectors = [
      '[itemprop="jobLocation"]',
      '[data-test="location"]',
      '.location',
      '.job-location'
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        const text = el.textContent?.trim();
        if (text && text.length < 200) return text;
      }
    }

    return '';
  }

  guessSalary() {
    if (!document.body || !document.body.innerText) return '';
    
    const bodyText = document.body.innerText;
    // Look for salary patterns: $50,000 - $70,000 or $50K-$70K or $50k-70k/year
    const patterns = [
      /\$[\d,]+\s*[-–]\s*\$[\d,]+(?:\s*(?:per|\/)\s*(?:year|yr|annum|hour|hr))?/i,
      /\$[\d,]+[kK]\s*[-–]\s*\$?[\d,]+[kK](?:\s*(?:per|\/)\s*(?:year|yr|annum))?/i,
      /salary:\s*\$[\d,]+(?:\s*[-–]\s*\$[\d,]+)?/i
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) return match[0];
    }

    return '';
  }

  guessJobType() {
    if (!document.body || !document.body.innerText) return '';
    
    const bodyText = document.body.innerText.toLowerCase();
    const patterns = [
      /\b(full[-\s]?time)\b/i,
      /\b(part[-\s]?time)\b/i,
      /\b(contract)\b/i,
      /\b(intern(?:ship)?)\b/i,
      /\b(temporary)\b/i,
      /\b(freelance)\b/i,
      /\b(seasonal)\b/i
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      if (match) return match[0];
    }

    return '';
  }

  findJobDescription() {
    // Score all visible containers by their "job description-ness"
    const containers = Array.from(document.querySelectorAll('article, section, div, main'))
      .filter(el => el.offsetParent !== null); // visible only

    const scored = containers.map(el => {
      const text = el.innerText || '';
      const html = el.innerHTML || '';
      
      // Count words
      const wordCount = (text.match(/\b\w+\b/g) || []).length;
      
      // Count structural elements (lists, paragraphs)
      const structureScore = (
        el.querySelectorAll('li').length * 20 +
        el.querySelectorAll('p').length * 15 +
        el.querySelectorAll('br').length * 5
      );

      // Semantic keywords indicating job description
      const semanticKeywords = [
        'responsibilities', 'requirements', 'qualifications',
        'about the role', 'what you', 'we are looking',
        'job description', 'duties', 'skills', 'experience'
      ];
      const semanticScore = semanticKeywords.reduce((score, keyword) => {
        return score + (text.toLowerCase().includes(keyword) ? 50 : 0);
      }, 0);

      // Penalize if it's likely navigation, header, footer, or sidebar
      const penalties = [
        text.toLowerCase().includes('cookie') ? -100 : 0,
        text.toLowerCase().includes('privacy policy') ? -50 : 0,
        text.toLowerCase().includes('copyright') ? -50 : 0,
        text.toLowerCase().includes('similar jobs') ? -100 : 0,
        text.toLowerCase().includes('related jobs') ? -100 : 0,
        text.toLowerCase().includes('recommended jobs') ? -100 : 0,
        text.toLowerCase().includes('sign in') ? -100 : 0,
        text.toLowerCase().includes('register') ? -50 : 0,
        el.tagName === 'NAV' ? -200 : 0,
        el.tagName === 'HEADER' ? -200 : 0,
        el.tagName === 'FOOTER' ? -200 : 0,
        el.className?.toLowerCase().includes('nav') ? -100 : 0,
        el.className?.toLowerCase().includes('header') ? -100 : 0,
        el.className?.toLowerCase().includes('footer') ? -100 : 0,
        el.className?.toLowerCase().includes('sidebar') ? -150 : 0,
        el.id?.toLowerCase().includes('header') ? -100 : 0,
        el.id?.toLowerCase().includes('nav') ? -100 : 0,
        el.id?.toLowerCase().includes('sidebar') ? -150 : 0
      ];

      const totalScore = wordCount + structureScore + semanticScore + penalties.reduce((a, b) => a + b, 0);

      return {
        element: el,
        score: totalScore,
        wordCount,
        text
      };
    });

    // Sort by score and pick the best
    scored.sort((a, b) => b.score - a.score);

    // Find the first one that looks like a job description
    const best = scored.find(item => {
      const lowerText = item.text.toLowerCase();
      return item.wordCount > 100 && (
        lowerText.includes('responsibilities') ||
        lowerText.includes('requirements') ||
        lowerText.includes('qualifications') ||
        lowerText.includes('description')
      );
    }) || scored[0];

    if (best && best.element) {
      return this.cleanText(best.element.innerHTML);
    }

    return '';
  }

  /**
   * Helper methods
   */
  getTextContent(selector) {
    const el = document.querySelector(selector);
    return el?.textContent?.trim() || '';
  }

  getHTMLContent(selector) {
    const el = document.querySelector(selector);
    return el ? this.cleanText(el.innerHTML) : '';
  }

  getTextFromSelectors(selectors) {
    for (const selector of selectors) {
      const text = this.getTextContent(selector);
      if (text) return text;
    }
    return '';
  }

  getHTMLFromSelectors(selectors) {
    for (const selector of selectors) {
      const html = this.getHTMLContent(selector);
      if (html) return html;
    }
    return '';
  }

  cleanText(htmlOrText) {
    if (!htmlOrText) return '';

    // Convert HTML to text
    const el = document.createElement('div');
    el.innerHTML = htmlOrText;

    // Get text content preserving structure
    let text = el.innerText || el.textContent || '';

    // Clean up whitespace
    text = text
      .replace(/\u00a0/g, ' ') // non-breaking spaces
      .replace(/[ \t]+\n/g, '\n') // trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n') // collapse multiple newlines
      .trim();

    return text;
  }

  mergeData(sources) {
    const merged = {
      jobTitle: '',
      companyName: '',
      location: '',
      jobDescription: '',
      salary: '',
      jobType: ''
    };

    // Merge in order of priority (first non-empty value wins)
    for (const source of sources) {
      if (!source) continue;

      for (const key in merged) {
        if (!merged[key] && source[key]) {
          merged[key] = source[key];
        }
      }
    }

    return merged;
  }

  isComplete(data, threshold = 0.7) {
    if (!data) return false;

    const fields = ['jobTitle', 'companyName', 'jobDescription'];
    const filled = fields.filter(field => data[field] && data[field].length > 0);
    
    return filled.length / fields.length >= threshold;
  }

  normalize(data) {
    // Normalize employment type to standard values
    const mapType = (str = '') => {
      if (!str || typeof str !== 'string') return '';
      const lower = str.toLowerCase();
      if (lower.includes('full')) return 'Full-time';
      if (lower.includes('part')) return 'Part-time';
      if (lower.includes('contract')) return 'Contract';
      if (lower.includes('intern')) return 'Internship';
      if (lower.includes('temp')) return 'Temporary';
      if (lower.includes('seasonal')) return 'Seasonal';
      if (lower.includes('freelance')) return 'Freelance';
      return str || '';
    };

    // Smart truncation at word boundaries (7000 char limit)
    const smartTruncate = (text, maxLength = 7000) => {
      if (!text || text.length <= maxLength) {
        return text;
      }
      
      // Truncate to max length
      let truncated = text.substring(0, maxLength);
      
      // Find the last complete word (space, newline, or punctuation)
      const lastSpace = truncated.lastIndexOf(' ');
      const lastNewline = truncated.lastIndexOf('\n');
      const lastPeriod = truncated.lastIndexOf('.');
      
      // Use the best boundary within last 100 chars to avoid cutting too much
      const cutPoint = Math.max(
        lastPeriod > maxLength - 100 ? lastPeriod + 1 : 0,
        lastNewline > maxLength - 50 ? lastNewline : 0,
        lastSpace > maxLength - 20 ? lastSpace : maxLength
      );
      
      truncated = text.substring(0, cutPoint).trim();
      
      // Add truncation indicator
      return truncated + '\n\n[Description truncated. View full details at the job posting.]';
    };

    return {
      jobTitle: data.jobTitle || '',
      companyName: data.companyName || '',
      location: data.location || '',
      jobDescription: smartTruncate(data.jobDescription, 7000),
      salary: data.salary || '',
      jobType: mapType(data.jobType)
    };
  }
}

// Make available globally
window.JobDataExtractor = JobDataExtractor;
