# Assignment — Meeting Notes Distiller Web

> ถอดความจากไฟล์ต้นฉบับ `Assignment - Meeting Notes Distiller Web.docx` เพื่อให้ requirement
> อยู่ใน repo ไม่ต้องพก .docx ไปมา เนื้อหาคงตามต้นฉบับ ไม่ตีความเพิ่ม
> การตีความและสิ่งที่ตัดสินใจไปแล้วอยู่ใน [`../CONTEXT.md`](../CONTEXT.md) และ [`adr/`](./adr/)

## Part 1 — Build the project

สร้าง GitHub repository แบบ public และ clone ลงเครื่องที่ต้องการใช้งานสำหรับทำงานในโปรเจคนี้
และรันคำสั่ง `claude` เพื่อสร้าง Meeting Notes Distiller Web คือ เว็บถอดใจความสำคัญของการประชุม
โดยมี required functionality ดังนี้

### Required Functionality

1. **Upload**
   - สามารถทำการ upload ข้อมูล meeting note ในรูปแบบไฟล์ `.txt` ได้ โดยการ upload
     สามารถ upload ไฟล์มากกว่า 1 ไฟล์ในครั้งเดียว หรือ upload หลายครั้งได้ และประมวลผลพร้อมกัน

2. **Process**
   - เมื่อ upload เสร็จ สามารถทำการ submit เพื่อเริ่มกระบวนการทำงาน เพื่อประมวลผล meeting note
     ที่ upload มา โดยวิเคราะห์แยกรายละเอียด โดยรองรับรูปแบบ transcripts ของ meeting note
     **อย่างน้อย 3 รูปแบบ** ที่โปรแกรมสามารถทำงานได้โดยไม่ crash (มีตัวอย่างของ transcript ให้)

3. **Extract**
   - สำหรับแต่ละ meeting note สิ่งที่ต้องการให้สรุปออกมา ประกอบด้วย
     1. หัวข้อที่พูดคุย
     2. ผู้เข้าร่วม
     3. สรุปโดยรวม แต่ละหัวข้อ (กรณีมีการพูดคุยมากกว่า 1 หัวข้อใน transcript)
     4. การตัดสินใจของแต่ละหัวข้อที่มีการพูดคุย
     5. Action item (ใคร ต้องทำอะไร และภายในเวลาเมื่อไร อ้างอิงตามที่มีใน transcript)

4. **Flag Problem**
   - สามารถระบุได้ถึง meeting ที่ไม่มีการตัดสิน (no decision) และความขัดแย้งหรือไม่สอดคล้องกัน
     ของ action items เช่น มีการพูดถึงวัน 2 วัน และมีการ go-live ระบบ โดยยังไม่มีการตัดสินใจ
     เลือกว่าเป็นวันใด

5. **Display in the browser**
   - แสดงผลบน browser ประกอบด้วย
     1. Meeting summary ต่อการประชุม
     2. Action item ที่ group ตามผู้รับผิดชอบ
     3. เรื่องที่ไม่มีผู้รับผิดชอบ หรือความไม่ชัดเจนของ action item

6. **Generate downloadable file**
   - สร้างผลลัพธ์ของข้อ 5.1 ในรูปแบบ MS Word เพื่อสามารถนำไปใช้ต่อได้ ผ่านการ download
     ผลหน้า browser ที่แสดง

7. **Tests**
   - มี unit test สำหรับ extraction logic อย่างน้อย 1 case สำหรับ edge case เช่น
     1. Logic การตรวจสอบ action item ที่ไม่มีผู้รับผิดชอบ
     2. Logic การตรวจสอบประชุมที่ไม่มีการตัดสินใจ (no-decision meeting)

### Tech Stack

- ใช้ tech stack ผู้ทำโจทย์เลือกได้เอง
- การ extraction อยู่ในรูปแบบ rule-based, heuristic หรือ LLM-assisted ผู้ทำโจทย์เลือกได้เอง

### Sample Data

- ตามไฟล์แนบ โดยมีหลายรูปแบบการประชุมและภาษาที่ต่างกัน

### Complexity Bar

- อย่างน้อย source code (source file) จะต้องถูกแยกออกเป็น 3 ส่วน คือ
  - Front end
  - Back end
  - Test suite
  - E2E (End to End Automation Test) ด้วย Playwright หรือ Robot Framework หรืออื่นๆ
- มี README ของโปรเจค เพื่ออธิบายรายละเอียดของ function และวิธีการรันและใช้งานในการรันบน
  local computer (หลังจาก clone โปรเจคไปแล้ว) รวมถึง design decision ต่างๆ ที่เกี่ยวข้อง

## Part 2 — Manipulate Claude's Instructions

- สร้างไฟล์ `CLAUDE.md` ของโปรเจค เพื่ออธิบาย project convention ต่างๆ
  - Tech stack
  - Coding style
  - Directory layout
  - Command ที่ใช้สำหรับการ run test/lint
  - สิ่งที่ต้องทำเสมอ หรือห้ามทำ (rules)
- ในระหว่างทำ assignment นี้ (โปรเจคนี้) หากมีการปรับแก้ `CLAUDE.md` ให้ปรับปรุงใน README
  เพื่ออธิบายถึงเหตุการปรับแก้ `CLAUDE.md`

## Part 3 — Manipulate Claude's Skills

1. สร้าง Skill (`.claude/skills/<name>/SKILL.md`) สำหรับ workflow หรือการทำงานซ้ำ ที่เกิดขึ้น
   ในระหว่างการทำ assignment นี้
2. Skill ที่สร้างจะต้องถูกเรียกใช้เข้ามาใน repository ที่จะ submit พร้อมทั้งอธิบายเหตุผลว่าทำไม
   ถึงสร้าง skill นี้ขึ้น

## Part 4 — สร้างเอกสารที่เกี่ยวข้อง

1. สร้างเอกสาร Software Requirement Specification หรือ Product Requirement Document
   ด้วย Claude ในรูปแบบ MS Word
2. สร้างเอกสาร Unit Test Case จาก Unit Test ในโค้ด ในรูปแบบ MS Excel
3. _[optional]_ สร้างเอกสาร SIT หรือ UAT Case จาก e2e ในโค้ด ในรูปแบบ MS Excel

## สิ่งที่ต้อง Submit ส่ง

1. URL Link ของ GitHub repo ที่ประกอบด้วย
   - Working project
   - Tests
     - Unit Test
     - E2E (optional)
   - `README.md`
   - `CLAUDE.md`
   - `.claude/skills/`
2. `README.md` จะต้องประกอบด้วย
   - design decision ของการออกแบบที่ทำมา (Part 1)
   - อธิบาย Skill ที่สร้างขึ้นในโปรเจค (Part 3)

## อื่นๆ

- สิ่งที่ไม่ได้กำหนดเป็น scope ในเอกสารนี้ สามารถทำเพิ่มเติมได้เอง และระบุใน design decision
