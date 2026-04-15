export type Language = 'en' | 'ar';

export const translations = {
  en: {
    // Auth
    signIn: 'Sign In',
    signUp: 'Create Account',
    email: 'Email',
    password: 'Password',
    username: 'Username',
    forgotPassword: 'Forgot password?',
    noAccount: "Don't have an account?",
    haveAccount: 'Already have an account?',
    // Navigation
    messages: 'Messages',
    friends: 'Friends',
    feed: 'Feed',
    settings: 'Settings',
    admin: 'Admin',
    nassai: 'NassAI',
    servers: 'Servers',
    // Chat
    typeMessage: 'Type a message...',
    searchMessages: 'Search in conversation...',
    online: 'Online',
    offline: 'Offline',
    // Friends
    addFriend: 'Add Friend',
    friendRequests: 'Friend Requests',
    pending: 'Pending',
    accept: 'Accept',
    reject: 'Reject',
    sendRequest: 'Send Request',
    searchUsers: 'Search users by username...',
    // General
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    loading: 'Loading...',
    logout: 'Logout',
  },
  ar: {
    // Auth
    signIn: 'تسجيل الدخول',
    signUp: 'إنشاء حساب',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    username: 'اسم المستخدم',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟',
    haveAccount: 'لديك حساب بالفعل؟',
    // Navigation
    messages: 'الرسائل',
    friends: 'الأصدقاء',
    feed: 'التغذية',
    settings: 'الإعدادات',
    admin: 'الإدارة',
    nassai: 'ناس AI',
    servers: 'السيرفرات',
    // Chat
    typeMessage: 'اكتب رسالة...',
    searchMessages: 'البحث في المحادثة...',
    online: 'متصل',
    offline: 'غير متصل',
    // Friends
    addFriend: 'إضافة صديق',
    friendRequests: 'طلبات الصداقة',
    pending: 'قيد الانتظار',
    accept: 'قبول',
    reject: 'رفض',
    sendRequest: 'إرسال طلب',
    searchUsers: 'ابحث عن المستخدمين بالاسم...',
    // General
    save: 'حفظ',
    cancel: 'إلغاء',
    delete: 'حذف',
    loading: 'جاري التحميل...',
    logout: 'تسجيل الخروج',
  },
};

export function t(key: keyof typeof translations.en, lang: Language): string {
  return translations[lang]?.[key] || translations.en[key] || key;
}
