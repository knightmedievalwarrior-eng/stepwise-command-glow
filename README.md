# Stepwise Command Center

ช่วยสร้างและปรับปรุงแอปพลิเคชัน "Guided Task Runner & AI Command Center" สำหรับจัดการงานซ้ำๆ โดยรวมฟังก์ชันจากระบบเก่า (Lovable) และดีไซน์ใหม่ (v0) เข้าด้วยกัน โครงสร้างต้องเป็นแบบ Responsive รองรับมือถือและจอใหญ่ แสดงผลลื่นไหล

โครงสร้างหน้าจอหลักที่ต้องรวมกัน:

1. หน้าแรก Command Center: มีคำทักทาย ช่อง AI Chat Command ปุ่ม Quick Actions [ออกใบเสนอราคา, ลงข้อมูลลูกค้า, คีย์เอกสาร] ส่วนงานค้าง และประวัติบอทหลังบ้าน

2. หน้า Real-Time Execution Display: แสดง Progress Bar และกล่อง Log สถานะการทำงานทีละขั้น (เชื่อมต่อ n8n ในอนาคต)

3. หน้า Wizard Task Runner: ขั้นตอนการทำงานทีละสเต็ป (1, 2, 3...) พร้อมฟอร์มกรอกข้อมูลและปุ่มควบคุม ย้อนกลับ/ถัดไป พร้อมระบบบันทึกอัตโนมัติ

4. หน้าสรุปและยืนยัน: ตรวจทานข้อมูลก่อนส่งจริงและหน้าจอ Success

ช่อง AI Chat Command ในหน้าแรก ต้องการให้ทำงานแบบไหนตอนนี้?

1.Al จริง (Lovable Al) ตอบคำถามและแปลงคำสั่งเป็นงานจริงด้วย AI (ต้องเปิด Lovable Cloud ใช้ Al Gateway)

2.จําลองการแยกค่าสั่ง จับคำสั่งที่พิมพ์ (เช่น "ออกใบเสนอราคา") แล้วเปิดหน้าที่เกี่ยวข้อง ท่างานทันทีไม่ต้องเชื่อมต่อ Al

"คำตอบคือเลือก ผสมทั้งสอง พิมพ์ได้ทั้งค่าถาม (ตอบด้วย AI) และค่าสั่ง (กระโดดไปหน้างาน)"

ข้อมูล (งานค้าง, ประวัติการทำงาน, ข้อมูลลูกค้า) ต้องการเก็บแบบไหน?

เลือกแบบ "ไม่เก็บข้อมูลใดๆ บน Server ทั้งสิ้น (No-Storage / Privacy-First)" ให้ระบบใช้การประมวลผลและจำลองข้อมูลชั่วคราวบนเบราว์เซอร์ของผู้ใช้ (Client-side / Local state) เท่านั้น เมื่อผู้ใช้ปิดหน้าเว็บหรือสิ้นสุดภารกิจ ให้ข้อมูลทั้งหมดถูกทำลายทิ้งทันที เพื่อความปลอดภัยและความเป็นส่วนตัวสูงสุดของลูกค้า แต่ยังมีบันทึกประวัติการใช้งานเพื่อให้ผู้ใช้ยังจำได้ว่าเคยใช้ระบบนี้ทำไรไปแล้วบ้าง

โทนสีดีไซน์ที่ เหมาะสมที่สุด คือ "สว่าง มินิมอล (Light Minimalist)"

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://stepwise-command-center.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/bd37507d-aa58-4a7d-bc17-866ac358add3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
