import React, { useState, useEffect } from 'react';
import {
  Form, Select, Button, Card, message, Spin, Slider, InputNumber,
  Tabs, Table, Tag, Badge, Space, Typography, Divider, Input
} from 'antd';
import {
  FormOutlined, UnorderedListOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ReloadOutlined
} from '@ant-design/icons';
import { db } from './firebase-config';
import { collection, getDocs, addDoc, updateDoc, doc, orderBy, query } from 'firebase/firestore';
import './index.css';

const { Option } = Select;
const { Title, Text } = Typography;

const STATUS_CONFIG = {
  pending:  { label: 'รอดำเนินการ', color: 'orange' },
  approved: { label: 'อนุมัติแล้ว',  color: 'green'  },
  rejected: { label: 'ปฏิเสธ',       color: 'red'    },
};

const App = () => {
  const [form] = Form.useForm();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [durationValue, setDurationValue] = useState(60);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'subjects'));
        const list = snap.docs.map(d => ({
          code: d.data().subject_code || d.data().code,
          name: d.data().subject_name || d.data().name,
        }));
        setSubjects(list);
      } catch {
        message.error('ไม่สามารถโหลดรายวิชาได้');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const q = query(collection(db, 'Exam_Requests'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch {
      message.error('ไม่สามารถโหลดรายการคำขอได้');
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'admin') fetchRequests();
  };

  const generateClassOptions = () => {
    const levels = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];
    return levels.map(level => (
      <Select.OptGroup label={level} key={level}>
        {[1,2,3,4,5,6,7,8,9].map(sec => (
          <Option key={`${level}/${sec}`} value={`${level}/${sec}`}>{level}/{sec}</Option>
        ))}
      </Select.OptGroup>
    ));
  };

  const onFinish = async (values) => {
    setSubmitting(true);
    try {
      await addDoc(collection(db, 'Exam_Requests'), {
        ...values,
        duration: durationValue,
        status: 'pending',
        timestamp: new Date(),
      });
      message.success('บันทึกข้อมูลสำเร็จ!');
      form.resetFields();
      setDurationValue(60);
    } catch {
      message.error('บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateDoc(doc(db, 'Exam_Requests', id), { status });
      setRequests(prev => prev.map(r => r.id === id ? { ...r, status } : r));
      message.success('อัปเดตสถานะเรียบร้อย');
    } catch {
      message.error('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const adminColumns = [
    {
      title: 'รหัสวิชา',
      dataIndex: 'subjectCode',
      key: 'subjectCode',
      width: 110,
    },
    {
      title: 'ชื่อครู',
      dataIndex: 'teacherName',
      key: 'teacherName',
      width: 130,
    },
    {
      title: 'ห้องเรียน',
      dataIndex: 'classLevels',
      key: 'classLevels',
      render: (val) => (
        <Space wrap size={4}>
          {(val || []).map(c => <Tag key={c} color="blue">{c}</Tag>)}
        </Space>
      ),
    },
    {
      title: 'วันที่สอบ',
      dataIndex: 'examDate',
      key: 'examDate',
      width: 110,
    },
    {
      title: 'เวลาสอบ',
      dataIndex: 'examTime',
      key: 'examTime',
      width: 90,
    },
    {
      title: 'ระยะเวลา',
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      render: (val) => `${val} นาที`,
    },
    {
      title: 'ประเภท',
      dataIndex: 'examType',
      key: 'examType',
      width: 120,
      render: (val) => val === 'in-schedule' ? 'ในตาราง' : 'นอกตาราง',
    },
    {
      title: 'สถานะ',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status, record) => (
        <Select
          value={status}
          size="small"
          style={{ width: 120 }}
          onChange={(val) => handleStatusChange(record.id, val)}
        >
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}>
              <Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag>
            </Option>
          ))}
        </Select>
      ),
    },
  ];

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-6">
          <Title level={2} style={{ color: '#1e3a8a', marginBottom: 4 }}>
            ระบบสำรวจเวลาสอบ
          </Title>
          <Text type="secondary">โรงเรียนบ้านมิ — บันทึกและจัดการคำขอสอบ</Text>
        </div>

        <Card className="shadow-xl rounded-2xl" bodyStyle={{ padding: '0 0 24px' }}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            size="large"
            tabBarStyle={{ paddingLeft: 24, paddingRight: 24, marginBottom: 0 }}
            items={[
              {
                key: 'form',
                label: (
                  <span><FormOutlined /> แบบฟอร์มยื่นคำขอ</span>
                ),
                children: (
                  <div className="px-6 pt-4">
                    {loading ? (
                      <div className="text-center py-12"><Spin size="large" /></div>
                    ) : (
                      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">

                        <Form.Item
                          name="teacherName"
                          label="ชื่อ-นามสกุลครูผู้สอน"
                          rules={[{ required: true, message: 'กรุณากรอกชื่อครู' }]}
                        >
                          <Input placeholder="เช่น นายสมชาย ใจดี" />
                        </Form.Item>

                        <Form.Item
                          name="subjectCode"
                          label="รหัสวิชา"
                          rules={[{ required: true, message: 'กรุณาเลือกรหัสวิชา' }]}
                        >
                          <Select showSearch placeholder="เลือกรหัสวิชา" optionFilterProp="children">
                            {subjects.map(s => (
                              <Option key={s.code} value={s.code}>{s.code} — {s.name}</Option>
                            ))}
                          </Select>
                        </Form.Item>

                        <Form.Item
                          name="classLevels"
                          label="ระดับชั้นและห้องที่สอบ"
                          rules={[{ required: true, message: 'กรุณาเลือกห้องเรียน' }]}
                        >
                          <Select mode="multiple" placeholder="เลือกห้องเรียน (เลือกได้หลายห้อง)">
                            {generateClassOptions()}
                          </Select>
                        </Form.Item>

                        <Form.Item label={`เวลาที่ใช้สอบ — ${durationValue} นาที`}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <Slider
                              min={30} max={180} step={15}
                              value={durationValue}
                              style={{ flex: 1 }}
                              marks={{ 30: '30', 60: '60', 90: '90', 120: '120', 150: '150', 180: '180' }}
                              onChange={(val) => setDurationValue(val)}
                            />
                            <InputNumber
                              min={30} max={180} step={15}
                              value={durationValue}
                              formatter={(val) => `${val} น.`}
                              parser={(val) => Number(val.replace(' น.', ''))}
                              onChange={(val) => setDurationValue(val || 30)}
                              style={{ width: 90 }}
                            />
                          </div>
                        </Form.Item>

                        <Form.Item
                          name="examType"
                          label="ประเภทการสอบ"
                          rules={[{ required: true, message: 'กรุณาเลือกประเภทการสอบ' }]}
                        >
                          <Select placeholder="เลือกประเภทการสอบ">
                            <Option value="in-schedule">ในตารางสอบ</Option>
                            <Option value="out-schedule">นอกตารางสอบ</Option>
                          </Select>
                        </Form.Item>

                        <Divider />
                        <Button
                          type="primary"
                          htmlType="submit"
                          loading={submitting}
                          block
                          size="large"
                          style={{ background: '#1e40af', borderColor: '#1e40af', borderRadius: 8 }}
                        >
                          บันทึกคำขอ
                        </Button>
                      </Form>
                    )}
                  </div>
                ),
              },
              {
                key: 'admin',
                label: (
                  <span>
                    <UnorderedListOutlined /> รายการคำขอ
                    {pendingCount > 0 && (
                      <Badge count={pendingCount} size="small" style={{ marginLeft: 6 }} />
                    )}
                  </span>
                ),
                children: (
                  <div className="px-4 pt-4">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <Space>
                        <CheckCircleOutlined style={{ color: '#16a34a' }} />
                        <Text>อนุมัติ: {requests.filter(r => r.status === 'approved').length}</Text>
                        <ClockCircleOutlined style={{ color: '#d97706' }} />
                        <Text>รอ: {pendingCount}</Text>
                      </Space>
                      <Button
                        icon={<ReloadOutlined />}
                        onClick={fetchRequests}
                        loading={loadingRequests}
                        size="small"
                      >
                        รีเฟรช
                      </Button>
                    </div>
                    <Table
                      columns={adminColumns}
                      dataSource={requests}
                      rowKey="id"
                      loading={loadingRequests}
                      scroll={{ x: 800 }}
                      size="small"
                      pagination={{ pageSize: 10, showSizeChanger: false }}
                      locale={{ emptyText: 'ยังไม่มีคำขอ' }}
                    />
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
};

export default App;
