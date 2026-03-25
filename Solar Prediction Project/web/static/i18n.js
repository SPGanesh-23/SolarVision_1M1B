/* ===================================
   SolarVision — i18n (Internationalization)
   Languages: English, Hindi, Tamil, Marathi
   =================================== */

const translations = {
    en: {
        // Mode Overlay
        overlay_title: 'Welcome to SolarVision',
        overlay_subtitle: 'Choose how you want to use the app',
        mode_professional: 'Professional Mode',
        mode_professional_desc: 'Advanced analytics for engineers.',
        mode_easy: 'Easy Home Mode',
        mode_easy_desc: 'Simple energy advice for your family.',
        switch_mode: '⇄ Switch Mode',

        // Village Input
        find_my_home: '📍 Find My Home',
        locating: '⏳ Finding your location...',
        location_fixed: 'Location Fixed',
        location_failed: 'Could not find location. Please try again.',
        location_denied: 'Location permission denied. Please allow location access.',
        select_panel: 'Select Your Solar Setup',
        panel_small: 'Small Setup',
        panel_small_desc: '1 Small Panel',
        panel_standard: 'Standard Setup',
        panel_standard_desc: '2 Standard Panels',
        panel_large: 'Large Array',
        panel_large_desc: 'Large Farm Array',
        predict_btn: '☀️ Predict My Energy',
        predicting: '⏳ Predicting...',

        // Village Results
        your_energy: 'Your Solar Energy',
        total_energy_today: 'Total Energy Today',
        energy_status_title: 'Energy Status',
        status_good: '☀️ Great solar day! Safe to use heavy appliances.',
        status_ok: '⛅ Moderate solar day. Use appliances sparingly.',
        status_low: '🌧️ Low solar day. Avoid heavy power usage.',
        what_you_can_run: 'What You Can Power',
        appliance_pump: 'Water Pump',
        appliance_bulb: 'LED Bulbs (×4)',
        appliance_fan: 'Ceiling Fan',
        appliance_tv: 'Television',
        appliance_phone: 'Smartphones (×3)',
        appliance_fridge: 'Refrigerator',
        appliance_iron: 'Electric Iron',
        appliance_washer: 'Washing Machine',
        hours: 'hours',
        advice_safe: 'Safe to use!',
        advice_sparingly: 'Use sparingly',
        advice_avoid: 'Avoid heavy use today',
        safety_buffer_note: '🛡️ Calculated with a safety buffer so you don\'t run out of power unexpectedly.',
        todays_weather: 'Today\'s Weather',
        predict_again: '🔄 Predict Again',
        cost_savings_title: '💰 Estimated Cost Savings',
        savings_label: 'Saved vs. grid electricity today',
        savings_rate_note: 'Based on avg. ₹8/kWh grid rate',

        // Shared
        language: 'Language',
        kwh: 'kWh',
    },

    hi: {
        overlay_title: 'SolarVision में आपका स्वागत है',
        overlay_subtitle: 'चुनें कि आप ऐप का उपयोग कैसे करना चाहते हैं',
        mode_professional: 'प्रोफेशनल मोड',
        mode_professional_desc: 'इंजीनियरों के लिए उन्नत विश्लेषण।',
        mode_easy: 'आसान होम मोड',
        mode_easy_desc: 'आपके परिवार के लिए सरल ऊर्जा सलाह।',
        switch_mode: '⇄ मोड बदलें',

        find_my_home: '📍 मेरा घर खोजें',
        locating: '⏳ आपकी लोकेशन खोज रहे हैं...',
        location_fixed: 'लोकेशन मिल गई',
        location_failed: 'लोकेशन नहीं मिली। कृपया पुनः प्रयास करें।',
        location_denied: 'लोकेशन अनुमति अस्वीकृत। कृपया एक्सेस दें।',
        select_panel: 'अपना सोलर सेटअप चुनें',
        panel_small: 'छोटा सेटअप',
        panel_small_desc: '1 छोटा पैनल',
        panel_standard: 'स्टैंडर्ड सेटअप',
        panel_standard_desc: '2 स्टैंडर्ड पैनल',
        panel_large: 'बड़ा ऐरे',
        panel_large_desc: 'बड़ा फ़ार्म ऐरे',
        predict_btn: '☀️ मेरी ऊर्जा का अनुमान',
        predicting: '⏳ अनुमान लगा रहे हैं...',

        your_energy: 'आपकी सौर ऊर्जा',
        total_energy_today: 'आज की कुल ऊर्जा',
        energy_status_title: 'ऊर्जा स्थिति',
        status_good: '☀️ बेहतरीन सौर दिन! भारी उपकरण चलाना सुरक्षित है।',
        status_ok: '⛅ मध्यम सौर दिन। उपकरणों का कम उपयोग करें।',
        status_low: '🌧️ कम सौर दिन। भारी बिजली उपयोग से बचें।',
        what_you_can_run: 'आप क्या चला सकते हैं',
        appliance_pump: 'पानी का पम्प',
        appliance_bulb: 'LED बल्ब (×4)',
        appliance_fan: 'छत का पंखा',
        appliance_tv: 'टेलीविज़न',
        appliance_phone: 'स्मार्टफोन (×3)',
        appliance_fridge: 'फ्रिज',
        appliance_iron: 'इलेक्ट्रिक आयरन',
        appliance_washer: 'वाशिंग मशीन',
        hours: 'घंटे',
        advice_safe: 'उपयोग करना सुरक्षित!',
        advice_sparingly: 'कम उपयोग करें',
        advice_avoid: 'आज भारी उपयोग से बचें',
        safety_buffer_note: '🛡️ सुरक्षा बफ़र के साथ गणना की गई है ताकि अचानक बिजली खत्म न हो।',
        todays_weather: 'आज का मौसम',
        predict_again: '🔄 फिर से अनुमान लगाएं',
        cost_savings_title: '💰 अनुमानित लागत बचत',
        savings_label: 'आज ग्रिड बिजली बनाम बचत',
        savings_rate_note: 'औसत ₹8/kWh ग्रिड दर पर आधारित',

        language: 'भाषा',
        kwh: 'kWh',
    },

    ta: {
        overlay_title: 'SolarVision-க்கு வரவேற்கிறோம்',
        overlay_subtitle: 'நீங்கள் எவ்வாறு பயன்படுத்த விரும்புகிறீர்கள் என்பதைத் தேர்ந்தெடுக்கவும்',
        mode_professional: 'நிபுணர் பயன்முறை',
        mode_professional_desc: 'பொறியாளர்களுக்கான மேம்பட்ட பகுப்பாய்வு.',
        mode_easy: 'எளிய வீட்டு பயன்முறை',
        mode_easy_desc: 'உங்கள் குடும்பத்திற்கான எளிய ஆற்றல் ஆலோசனை.',
        switch_mode: '⇄ பயன்முறை மாற்று',

        find_my_home: '📍 என் வீட்டைக் கண்டுபிடி',
        locating: '⏳ உங்கள் இருப்பிடத்தைக் கண்டறிகிறது...',
        location_fixed: 'இருப்பிடம் கண்டறியப்பட்டது',
        location_failed: 'இருப்பிடத்தைக் கண்டறிய முடியவில்லை. மீண்டும் முயற்சிக்கவும்.',
        location_denied: 'இருப்பிட அனுமதி மறுக்கப்பட்டது. அணுகலை அனுமதிக்கவும்.',
        select_panel: 'உங்கள் சோலார் அமைப்பைத் தேர்ந்தெடுக்கவும்',
        panel_small: 'சிறிய அமைப்பு',
        panel_small_desc: '1 சிறிய பேனல்',
        panel_standard: 'நிலையான அமைப்பு',
        panel_standard_desc: '2 நிலையான பேனல்கள்',
        panel_large: 'பெரிய வரிசை',
        panel_large_desc: 'பெரிய பண்ணை வரிசை',
        predict_btn: '☀️ எனது ஆற்றலைக் கணிக்கவும்',
        predicting: '⏳ கணிக்கிறது...',

        your_energy: 'உங்கள் சூரிய ஆற்றல்',
        total_energy_today: 'இன்றைய மொத்த ஆற்றல்',
        energy_status_title: 'ஆற்றல் நிலை',
        status_good: '☀️ சிறந்த சூரிய நாள்! கனரக சாதனங்களைப் பயன்படுத்துவது பாதுகாப்பானது.',
        status_ok: '⛅ மிதமான சூரிய நாள். சாதனங்களை குறைவாகப் பயன்படுத்தவும்.',
        status_low: '🌧️ குறைந்த சூரிய நாள். கனரக மின் பயன்பாட்டைத் தவிர்க்கவும்.',
        what_you_can_run: 'நீங்கள் இயக்கக்கூடியவை',
        appliance_pump: 'நீர் பம்ப்',
        appliance_bulb: 'LED பல்புகள் (×4)',
        appliance_fan: 'உச்சவிசிறி',
        appliance_tv: 'தொலைக்காட்சி',
        appliance_phone: 'ஸ்மார்ட்போன்கள் (×3)',
        appliance_fridge: 'குளிர்சாதனப் பெட்டி',
        appliance_iron: 'மின்சார இஸ்திரி பெட்டி',
        appliance_washer: 'சலவை இயந்திரம்',
        hours: 'மணி நேரம்',
        advice_safe: 'பயன்படுத்துவது பாதுகாப்பானது!',
        advice_sparingly: 'குறைவாகப் பயன்படுத்தவும்',
        advice_avoid: 'இன்று கனரக பயன்பாட்டைத் தவிர்க்கவும்',
        safety_buffer_note: '🛡️ நீங்கள் எதிர்பாராமல் மின்சாரம் தீர்ந்துவிடாமல் இருக்க பாதுகாப்பு இடையகத்துடன் கணக்கிடப்பட்டது.',
        todays_weather: 'இன்றைய வானிலை',
        predict_again: '🔄 மீண்டும் கணிக்கவும்',
        cost_savings_title: '💰 மதிப்பிடப்பட்ட செலவு சேமிப்பு',
        savings_label: 'இன்று கட்ட மின்சாரம் vs சேமிப்பு',
        savings_rate_note: 'சராசரி ₹8/kWh கட்டணத்தின் அடிப்படையில்',

        language: 'மொழி',
        kwh: 'kWh',
    },

    mr: {
        overlay_title: 'SolarVision मध्ये आपले स्वागत आहे',
        overlay_subtitle: 'तुम्हाला ॲप कसे वापरायचे ते निवडा',
        mode_professional: 'प्रोफेशनल मोड',
        mode_professional_desc: 'अभियंत्यांसाठी प्रगत विश्लेषण.',
        mode_easy: 'सोपा होम मोड',
        mode_easy_desc: 'तुमच्या कुटुंबासाठी सोपा ऊर्जा सल्ला.',
        switch_mode: '⇄ मोड बदला',

        find_my_home: '📍 माझे घर शोधा',
        locating: '⏳ तुमचे स्थान शोधत आहे...',
        location_fixed: 'स्थान सापडले',
        location_failed: 'स्थान सापडले नाही. कृपया पुन्हा प्रयत्न करा.',
        location_denied: 'स्थान परवानगी नाकारली. कृपया ॲक्सेस द्या.',
        select_panel: 'तुमचा सोलर सेटअप निवडा',
        panel_small: 'लहान सेटअप',
        panel_small_desc: '1 लहान पॅनेल',
        panel_standard: 'स्टँडर्ड सेटअप',
        panel_standard_desc: '2 स्टँडर्ड पॅनेल',
        panel_large: 'मोठा ॲरे',
        panel_large_desc: 'मोठा फार्म ॲरे',
        predict_btn: '☀️ माझ्या ऊर्जेचा अंदाज',
        predicting: '⏳ अंदाज लावत आहे...',

        your_energy: 'तुमची सौर ऊर्जा',
        total_energy_today: 'आजची एकूण ऊर्जा',
        energy_status_title: 'ऊर्जा स्थिती',
        status_good: '☀️ उत्तम सौर दिवस! भारी उपकरणे चालवणे सुरक्षित आहे.',
        status_ok: '⛅ मध्यम सौर दिवस. उपकरणे कमी वापरा.',
        status_low: '🌧️ कमी सौर दिवस. भारी वीज वापरापासून दूर रहा.',
        what_you_can_run: 'तुम्ही काय चालवू शकता',
        appliance_pump: 'पाण्याचा पंप',
        appliance_bulb: 'LED बल्ब (×4)',
        appliance_fan: 'छतावरील पंखा',
        appliance_tv: 'टेलिव्हिजन',
        appliance_phone: 'स्मार्टफोन्स (×3)',
        appliance_fridge: 'फ्रीज',
        appliance_iron: 'इलेक्ट्रिक इस्त्री',
        appliance_washer: 'वॉशिंग मशीन',
        hours: 'तास',
        advice_safe: 'वापरणे सुरक्षित!',
        advice_sparingly: 'कमी वापरा',
        advice_avoid: 'आज भारी वापर टाळा',
        safety_buffer_note: '🛡️ सुरक्षा बफरसह गणना केली आहे जेणेकरून अनपेक्षितपणे वीज संपणार नाही.',
        todays_weather: 'आजचे हवामान',
        predict_again: '🔄 पुन्हा अंदाज लावा',
        cost_savings_title: '💰 अंदाजित खर्च बचत',
        savings_label: 'आज ग्रिड वीज विरुद्ध बचत',
        savings_rate_note: 'सरासरी ₹8/kWh ग्रिड दरावर आधारित',

        language: 'भाषा',
        kwh: 'kWh',
    },
};

let currentLang = 'en';

/**
 * Get translated string for a key.
 */
function t(key) {
    const lang = translations[currentLang] || translations.en;
    return lang[key] || translations.en[key] || key;
}

/**
 * Set the active language and re-render translatable elements.
 */
function setLanguage(lang) {
    if (!translations[lang]) lang = 'en';
    currentLang = lang;
    localStorage.setItem('solarvision-lang', lang);
    applyTranslations();
}

/**
 * Apply translations to all elements with data-i18n attribute.
 */
function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });
    // Also update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}
