# Stepwise Command Center (Task Runner SaaS)

## 📌 Project Overview
Stepwise Command Center is a scalable, **100% Local-First & Privacy-First** SaaS application designed for office workers, accountants, and operations teams to automate repetitive tasks (such as Excel, Google Sheets, and document processing) directly inside their web browser.

---

## 🛠️ Architecture & Tech Stack
- **Frontend / UI:** Built via Lovable (v0-style responsive layout, supports mobile, tablet, and desktop).
- **Backend & Auth:** **Supabase** (handles secure user authentication, RLS security policies, and user profiles/metadata).
- **Processing Engine:** **Client-Side Processing (Local-First)** using browser memory and parsing libraries (e.g., SheetJS/xlsx) to ensure absolute data privacy and zero server-side file storage.
- **Version Control:** GitHub (Single Source of Truth for seamless multi-account collaboration).

---

## ✨ Key Features
1. **Command Center Hub:** 
   - Bilingual support (**TH / EN**) and Light/Dark Theme toggle[cite: 3].
   - AI Chat Command interface with Privacy-First execution badges (*"100% ในเครื่อง - เป็นส่วนตัว"*)[cite: 3].
   - Quick Actions menu for high-pain workflows (e.g., Quotation Generation, Customer Data Entry, Document Sorting)[cite: 3].
2. **Local-First Excel/CSV Studio:**
   - Drag-and-drop file upload zone.
   - Client-side data parsing and cleaning without sending sensitive corporate files to external cloud storage.
3. **Secure Hybrid Monetization:**
   - Built-in trial period management (e.g., 15-day trial countdown) and flexible usage/subscription tier checks.
   - Row Level Security (RLS) enabled on Supabase to isolate user data completely.

---

## 🔒 Privacy & Security Guarantee
- **No-Storage / Privacy-First Policy:** All tabular data and processing occur locally within the user's browser[cite: 3]. Data is cleared immediately upon session end, protecting corporate privacy and ensuring compliance.
- **Cost Optimization:** Minimized server API calls and client-side caching architecture designed to scale smoothly from hundreds to millions of users without runaway infrastructure costs.

---

## 🚀 Live App & Development
- **Live Preview:** [Stepwise Command Center Preview](https://stepwise-command-center.lovable.app)[cite: 3]
- **Lovable Workspace:** [Edit in Lovable](https://lovable.dev/projects/bd37507d-aa58-4a7d-bc17-866ac358add3)[cite: 3]

---
