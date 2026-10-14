window.SITE_CONFIG = {
  brandName: "Arslan Graphics",
  // Yahan apne logo ka direct image link paste karein.
  logoUrl: "https://i.ibb.co/fzMFhYw9/1000031050-removebg-preview.png",
  // Yahan favicon ka direct image link paste karein.
  faviconUrl: "https://i.ibb.co/fzMFhYw9/1000031050-removebg-preview.png",
  // Yahan hero section ki image ka direct image link paste karein.
  heroImageUrl: "https://i.ibb.co/TxvwxTjQ/file-0000000040708211aa32b59315e347da.png",
  // Yahan About section ki image ka direct image link paste karein.
  aboutImageUrl: "",

  contact: {
    email: "mianarslan7526@gmail.com",
    // International format: country code ke saath, + ya spaces ke baghair.
    whatsappNumber: "923108201521",
    phoneDisplay: "0310 8201521",
    // Yahan apna business address likhein (optional).
    address: "Punjab,Pakistan"
  },

  // Apne social account ke links yahan paste karein; khaali URLs hide ho jayenge.
  // iconUrl optional hai. Agar khaali ho to built-in icon use hoga.
  socialLinks: [
    { name: "Instagram", url: "", icon: "instagram", iconUrl: "" },
    { name: "Facebook", url: "", icon: "facebook", iconUrl: "" },
    { name: "TikTok", url: "", icon: "tiktok", iconUrl: "" },
    { name: "YouTube", url: "", icon: "youtube", iconUrl: "" },
    { name: "LinkedIn", url: "", icon: "linkedin", iconUrl: "" },
    { name: "Behance", url: "", icon: "behance", iconUrl: "" }
  ],

  // Firebase project ki web app values yahan paste karein.
  firebase: {
    apiKey: "",
    authDomain: "",
    databaseURL: "",
    projectId: "",
    storageBucket: "",
    messagingSenderId: "",
    appId: ""
  },
  // Firebase console se admin user ka UID yahan paste karein.
  adminUid: "",

  aboutTitle: "Design that makes your brand impossible to ignore.",
  aboutText: "I’m Arslan, a graphic designer helping ambitious businesses turn their ideas into clear, memorable visual identities. From the first sketch to the final files, every detail is made with purpose.",
  stats: [
    { value: 5, suffix: "+", label: "Years of experience" },
    { value: 120, suffix: "+", label: "Projects delivered" },
    { value: 80, suffix: "+", label: "Happy clients" }
  ],
  skills: ["Adobe Photoshop", "Adobe Illustrator", "Brand strategy", "Packaging"],

  // Services add, edit, ya remove karne ke liye sirf is array ko update karein.
  services: [
    {
      id: "branding",
      title: "Branding",
      shortDescription: "A confident identity system built to make your business memorable.",
      fullDescription: "Build a brand people recognize and trust. Together we’ll shape a distinctive visual direction and a practical identity system that stays consistent wherever your business shows up.",
      // Yahan service ki image ka direct image link paste karein.
      imageUrl: "",
      price: 8000,
      priceLabel: "Starting from Rs. 8,000",
      deliveryTime: "5–7 working days",
      features: ["Logo and visual identity", "Colour palette and typography", "Social profile essentials", "Brand usage guide"]
    },
    {
      id: "logo-design",
      title: "Logo Design",
      shortDescription: "A distinctive, versatile logo designed around your story.",
      fullDescription: "Get a polished logo that works everywhere—from your storefront and social profiles to print. The process includes thoughtful concept development and refined final files ready for use.",
      // Yahan service ki image ka direct image link paste karein.
      imageUrl: "",
      price: 3000,
      priceLabel: "Starting from Rs. 3,000",
      deliveryTime: "2–3 working days",
      features: ["Custom original concepts", "Refinement and revisions", "Colour and monochrome versions", "High-resolution final files"]
    },
    {
      id: "packaging-design",
      title: "Packaging Design",
      shortDescription: "Shelf-ready packaging that makes a lasting first impression.",
      fullDescription: "Turn a great product into an experience customers remember. Packaging is designed around your product, audience, and print requirements so the final result looks as good in hand as it does on screen.",
      // Yahan service ki image ka direct image link paste karein.
      imageUrl: "",
      price: 6000,
      priceLabel: "Starting from Rs. 6,000",
      deliveryTime: "4–6 working days",
      features: ["Custom packaging layout", "Print-ready artwork", "Product-focused visual direction", "Mockup presentation"]
    },
    {
      id: "business-card-design",
      title: "Business Card Design",
      shortDescription: "A little card that leaves a big, professional impression.",
      fullDescription: "Make every introduction count with a clean, considered business card. You’ll receive a print-ready design that puts your contact details and brand identity in the right hands.",
      // Yahan service ki image ka direct image link paste karein.
      imageUrl: "",
      price: 1500,
      priceLabel: "Starting from Rs. 1,500",
      deliveryTime: "1–2 working days",
      features: ["Front and back design", "Print-ready export", "Brand-matched typography", "Digital proof before delivery"]
    }
  ]
};
