import React, { useState, useEffect } from 'react';
import { Form, Select, Button, Card, message, Spin, Slider, InputNumber } from 'antd';
import { db } from './firebase-config';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import './index.css';

const { Option } = Select;

const App = () => {
  const [form] = Form.useForm(); // ประกาศ form ตรงนี้เพื่อให้ Slider ใช้งานได้
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, "subjects"));
        const list = querySnapshot.docs.map(doc => ({
          code: doc.data().subject_code || doc.data().code,
          name: doc.data().subject_name || doc.data().name
        }));
        setSubjects(list);
        setLoading(false);
      } catch (error) {
        message.error("ไม่สามารถโหลดรายวิชาได้");
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const generateClassOptions = () => {
    const levels = ["ม.1", "ม.2", "ม.3", "ม.4", "ม.5", "ม.6"];
    const sections = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    return levels.map(level => (
      <Select.OptGroup label={level} key={level}>
        {sections.map(sec => (
          <Option key={`${level}/${sec}`} value={`${level}/${sec}`}>{level}/{sec}</Option>
        ))}
      </Select.OptGroup>
    ));
  };

  const onFinish = async (values) => {
    try {
      await addDoc(collection(db, "Exam_Requests"), {
        ...values,
        status: "pending",
        timestamp: new Date()
      });
      message.success("บันทึกข้อมูลสำเร็จ!");
      form.resetFields();
    } catch (error) {
      message.error("บันทึกข้อมูลไม่สำเร็จ");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card title="ระบบสำรวจข้อมูลสอบ" className="w-full max-w-lg shadow-lg">
        {loading ? <div className="text-center"><Spin /></div> : (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <Form.Item name="subjectCode" label="รหัสวิชา" rules={[{ required: true }]}>
              <Select showSearch placeholder="เลือกรหัสวิชา">
                {subjects.map(s => <Option key={s.code} value={s.code}>{s.code} - {s.name}</Option>)}
              </Select>
            </Form.Item>
            
            <Form.Item name="classLevels" label="ระดับชั้นและห้องที่สอบ" rules={[{ required: true }]}>
              <Select mode="multiple" placeholder="เลือกห้องเรียน">{generateClassOptions()}</Select>
            </Form.Item>

            <Form.Item name="duration" label="เวลาที่ใช้สอบ (นาที)" initialValue={60} rules={[{ required: true }]}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                <Slider min={30} max={180} step={15} style={{ flex: 1 }} 
                  onChange={(val) => form.setFieldsValue({ duration: val })} />
                <InputNumber min={30} max={180} step={15} formatter={(val) => `${val} นาที`} />
              </div>
            </Form.Item>

            <Form.Item name="examType" label="ประเภทการสอบ" rules={[{ required: true }]}>
              <Select placeholder="ในหรือนอกตาราง">
                <Option value="in-schedule">ในตารางสอบ</Option>
                <Option value="out-schedule">นอกตารางสอบ</Option>
              </Select>
            </Form.Item>

            <Button type="primary" htmlType="submit" className="w-full h-10 bg-blue-600">บันทึกข้อมูล</Button>
          </Form>
        )}
      </Card>
    </div>
  );
};

export default App;