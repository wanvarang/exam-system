import React, { useState, useEffect } from 'react';
import {
  Form, Select, Button, Card, message, Spin, Slider, InputNumber,
  Tabs, Table, Tag, Badge, Space, Typography, Divider, Input,
  Modal, Calendar, TimePicker, Row, Col, List
} from 'antd';
import {
  FormOutlined, UnorderedListOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ReloadOutlined, CalendarOutlined,
  PlusOutlined, HomeOutlined
} from '@ant-design/icons';
import { db } from './firebase-config';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  orderBy, query, onSnapshot
} from 'firebase/firestore';
import dayjs from 'dayjs';
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
  const [scheduleForm] = Form.useForm();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [requests, setRequests] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [durationValue, setDurationValue] = useState(60);
  const [examRooms, setExamRooms] = useState([]);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [newRoomInput, setNewRoomInput] = useState('');
  const [addingRoom, setAddingRoom] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const snap = await getDocs(collection(db, 'subjects'));
        setSubjects(snap.docs.map(d => ({
          code: d.data().subject_code || d.data().code,
          name: d.data().subject_name || d.data().name,
        })));
      } catch {
        message.error('ไม่สามารถโหลดรายวิชาได้');
      } finally {
        setLoading(false);
      }
    };
    fetchSubjects();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'Exam_Requests'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingRequests(false);
    }, () => setLoadingRequests(false));
    return () => unsub();
  }, []);

  useEffect(() => {
    getDocs(collection(db, 'examRooms'))
      .then(snap => setExamRooms(snap.docs.map(d => ({ id: d.id, name: d.data().name }))))
      .catch(() => {});
  }, []);

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
        ...values, duration: durationValue, status: 'pending', timestamp: new Date(),
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
      message.success('อัปเดตสถานะเรียบร้อย');
    } catch {
      message.error('ไม่สามารถอัปเดตสถานะได้');
    }
  };

  const pendingRequests = requests.filter(r => r.status === 'pending');
  const approvedRequests = requests.filter(r => r.status === 'approved' && r.examDate);
  const pendingCount = pendingRequests.length;

  const handleDateSelect = (date) => {
    if (pendingRequests.length === 0) {
      message.info('ไม่มีคำขอที่รอจัดตาราง');
      return;
    }
    setSelectedDate(date);
    scheduleForm.resetFields();
    setScheduleModalOpen(true);
  };

  const handleScheduleSubmit = async (values) => {
    setScheduling(true);
    try {
      await updateDoc(doc(db, 'Exam_Requests', values.requestId), {
        examDate: selectedDate.format('YYYY-MM-DD'),
        examTime: values.examTime.format('HH:mm'),
        examRoom: values.examRoom,
        status: 'approved',
      });
      message.success('จัดตารางสอบเรียบร้อย!');
      setScheduleModalOpen(false);
    } catch {
      message.error('ไม่สามารถบันทึกตารางสอบได้');
    } finally {
      setScheduling(false);
    }
  };

  const handleAddRoom = async () => {
    if (!newRoomInput.trim()) return;
    setAddingRoom(true);
    try {
      const ref = await addDoc(collection(db, 'examRooms'), { name: newRoomInput.trim() });
      const newRoom = { id: ref.id, name: newRoomInput.trim() };
      setExamRooms(prev => [...prev, newRoom]);
      scheduleForm.setFieldsValue({ examRoom: newRoomInput.trim() });
      setNewRoomInput('');
      message.success(`เพิ่มห้อง "${newRoom.name}" แล้ว`);
    } catch {
      message.error('ไม่สามารถเพิ่มห้องสอบได้');
    } finally {
      setAddingRoom(false);
    }
  };

  const dateCellRender = (date) => {
    const dateStr = date.format('YYYY-MM-DD');
    const events = approvedRequests.filter(r => r.examDate === dateStr);
    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {events.map(e => (
          <li key={e.id}>
            <Tag color="blue"
              style={{ cursor: 'pointer', marginBottom: 2, fontSize: 11, maxWidth: '100%' }}
              onClick={(ev) => { ev.stopPropagation(); setSelectedEvent(e); setDetailModalOpen(true); }}>
              {e.examTime} {e.subjectCode}
            </Tag>
          </li>
        ))}
      </ul>
    );
  };

  const adminColumns = [
    { title: 'รหัสวิชา', dataIndex: 'subjectCode', key: 'subjectCode', width: 110 },
    { title: 'ชื่อครู', dataIndex: 'teacherName', key: 'teacherName', width: 130 },
    { title: 'ห้องเรียน', dataIndex: 'classLevels', key: 'classLevels',
      render: (val) => <Space wrap size={4}>{(val||[]).map(c=><Tag key={c} color="blue">{c}</Tag>)}</Space> },
    { title: 'ระยะเวลา', dataIndex: 'duration', key: 'duration', width: 100, render: v => `${v} นาที` },
    { title: 'ประเภท', dataIndex: 'examType', key: 'examType', width: 120, render: v => v==='in-schedule'?'ในตาราง':'นอกตาราง' },
    { title: 'วันสอบ', dataIndex: 'examDate', key: 'examDate', width: 110 },
    { title: 'เวลา', dataIndex: 'examTime', key: 'examTime', width: 80 },
    { title: 'ห้องสอบ', dataIndex: 'examRoom', key: 'examRoom', width: 100 },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130,
      render: (status, record) => (
        <Select value={status} size="small" style={{ width: 120 }} onChange={val => handleStatusChange(record.id, val)}>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
            <Option key={key} value={key}><Tag color={cfg.color} style={{ margin: 0 }}>{cfg.label}</Tag></Option>
          ))}
        </Select>
      )},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <Title level={2} style={{ color: '#1e3a8a', marginBottom: 4 }}>ระบบสำรวจเวลาสอบ</Title>
          <Text type="secondary">โรงเรียนบ้านมิ — บันทึกและจัดการคำขอสอบ</Text>
        </div>
        <Card className="shadow-xl rounded-2xl" styles={{ body: { padding: '0 0 24px' } }}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large"
            tabBarStyle={{ paddingLeft: 24, paddingRight: 24, marginBottom: 0 }}
            items={[
              {
                key: 'form',
                label: <span><FormOutlined /> แบบฟอร์มยื่นคำขอ</span>,
                children: (
                  <div className="px-6 pt-4">
                    {loading ? <div className="text-center py-12"><Spin size="large" /></div> : (
                      <Form form={form} layout="vertical" onFinish={onFinish} requiredMark="optional">
                        <Form.Item name="teacherName" label="ชื่อ-นามสกุลครูผู้สอน" rules={[{required:true,message:'กรุณากรอกชื่อครู'}]}>
                          <Input placeholder="เช่น นายสมชาย ใจดี" />
                        </Form.Item>
                        <Form.Item name="subjectCode" label="รหัสวิชา" rules={[{required:true,message:'กรุณาเลือกรหัสวิชา'}]}>
                          <Select showSearch placeholder="เลือกรหัสวิชา" optionFilterProp="children">
                            {subjects.map(s => <Option key={s.code} value={s.code}>{s.code} — {s.name}</Option>)}
                          </Select>
                        </Form.Item>
                        <Form.Item name="classLevels" label="ระดับชั้นและห้องที่สอบ" rules={[{required:true,message:'กรุณาเลือกห้องเรียน'}]}>
                          <Select mode="multiple" placeholder="เลือกห้องเรียน (เลือกได้หลายห้อง)">{generateClassOptions()}</Select>
                        </Form.Item>
                        <Form.Item label={`เวลาที่ใช้สอบ — ${durationValue} นาที`}>
                          <div style={{ display:'flex', alignItems:'center', gap:16 }}>
                            <Slider min={30} max={180} step={15} value={durationValue} style={{flex:1}}
                              marks={{30:'30',60:'60',90:'90',120:'120',150:'150',180:'180'}}
                              onChange={val => setDurationValue(val)} />
                            <InputNumber min={30} max={180} step={15} value={durationValue}
                              formatter={v=>`${v} น.`} parser={v=>Number(v.replace(' น.',''))}
                              onChange={v=>setDurationValue(v||30)} style={{width:90}} />
                          </div>
                        </Form.Item>
                        <Form.Item name="examType" label="ประเภทการสอบ" rules={[{required:true,message:'กรุณาเลือกประเภทการสอบ'}]}>
                          <Select placeholder="เลือกประเภทการสอบ">
                            <Option value="in-schedule">ในตารางสอบ</Option>
                            <Option value="out-schedule">นอกตารางสอบ</Option>
                          </Select>
                        </Form.Item>
                        <Divider />
                        <Button type="primary" htmlType="submit" loading={submitting} block size="large"
                          style={{background:'#1e40af',borderColor:'#1e40af',borderRadius:8}}>
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
                  <span><UnorderedListOutlined /> รายการคำขอ
                    {pendingCount>0 && <Badge count={pendingCount} size="small" style={{marginLeft:6}} />}
                  </span>
                ),
                children: (
                  <div className="px-4 pt-4">
                    <div className="flex justify-between items-center mb-4 px-2">
                      <Space>
                        <CheckCircleOutlined style={{color:'#16a34a'}} />
                        <Text>อนุมัติ: {requests.filter(r=>r.status==='approved').length}</Text>
                        <ClockCircleOutlined style={{color:'#d97706'}} />
                        <Text>รอ: {pendingCount}</Text>
                      </Space>
                    </div>
                    <Table columns={adminColumns} dataSource={requests} rowKey="id" loading={loadingRequests}
                      scroll={{x:900}} size="small" pagination={{pageSize:10,showSizeChanger:false}}
                      locale={{emptyText:'ยังไม่มีคำขอ'}} />
                  </div>
                ),
              },
              {
                key: 'schedule',
                label: (
                  <span><CalendarOutlined /> จัดตารางสอบ
                    {pendingCount>0 && <Badge count={pendingCount} size="small" style={{marginLeft:6}} />}
                  </span>
                ),
                children: (
                  <div className="px-4 pt-4">
                    <Row gutter={16}>
                      <Col xs={24} md={6}>
                        <Card size="small" style={{marginBottom:12}}
                          title={<span><ClockCircleOutlined style={{color:'#d97706'}} /> รอจัดตาราง ({pendingRequests.length})</span>}>
                          {pendingRequests.length === 0
                            ? <Text type="secondary">ไม่มีคำขอที่รอดำเนินการ</Text>
                            : <List size="small" dataSource={pendingRequests} renderItem={r => (
                                <List.Item style={{padding:'4px 0'}}>
                                  <div>
                                    <Text strong>{r.subjectCode}</Text><br />
                                    <Text type="secondary" style={{fontSize:12}}>{r.teacherName}</Text><br />
                                    <Space wrap size={2}>
                                      {(r.classLevels||[]).map(c=><Tag key={c} color="orange" style={{fontSize:10,margin:1}}>{c}</Tag>)}
                                    </Space>
                                  </div>
                                </List.Item>
                              )} />
                          }
                        </Card>
                        <Card size="small" title={<span><HomeOutlined /> ห้องสอบ ({examRooms.length})</span>}>
                          {examRooms.length===0
                            ? <Text type="secondary" style={{fontSize:12}}>ยังไม่มีห้องสอบ เพิ่มได้ตอนจัดตาราง</Text>
                            : <Space wrap size={4}>{examRooms.map(r=><Tag key={r.id} color="geekblue">{r.name}</Tag>)}</Space>
                          }
                        </Card>
                      </Col>
                      <Col xs={24} md={18}>
                        <Card size="small">
                          <Calendar
                            cellRender={(date, info) => info.type==='date' ? dateCellRender(date) : null}
                            onSelect={handleDateSelect}
                          />
                        </Card>
                      </Col>
                    </Row>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      <Modal title={`จัดตารางสอบ — ${selectedDate ? selectedDate.format('DD/MM/YYYY') : ''}`}
        open={scheduleModalOpen} onCancel={() => setScheduleModalOpen(false)} footer={null} destroyOnClose>
        <Form form={scheduleForm} layout="vertical" onFinish={handleScheduleSubmit}>
          <Form.Item name="requestId" label="เลือกคำขอ" rules={[{required:true,message:'กรุณาเลือกคำขอ'}]}>
            <Select placeholder="เลือกวิชาที่ต้องการจัดตาราง">
              {pendingRequests.map(r => (
                <Option key={r.id} value={r.id}>
                  {r.subjectCode} — {r.teacherName} ({(r.classLevels||[]).join(', ')})
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="examTime" label="เวลาเริ่มสอบ" rules={[{required:true,message:'กรุณาเลือกเวลา'}]}>
            <TimePicker format="HH:mm" minuteStep={15} style={{width:'100%'}} placeholder="เลือกเวลา" />
          </Form.Item>
          <Form.Item name="examRoom" label="ห้องสอบ" rules={[{required:true,message:'กรุณาเลือกห้องสอบ'}]}>
            <Select placeholder="เลือกห้องสอบ"
              dropdownRender={menu => (
                <>
                  {menu}
                  <Divider style={{margin:'8px 0'}} />
                  <div style={{padding:'0 8px 4px',display:'flex',gap:8}}>
                    <Input placeholder="ชื่อห้องใหม่" value={newRoomInput}
                      onChange={e => setNewRoomInput(e.target.value)}
                      onKeyDown={e => e.stopPropagation()} size="small" style={{flex:1}} />
                    <Button size="small" type="primary" icon={<PlusOutlined />} loading={addingRoom} onClick={handleAddRoom}>
                      เพิ่มห้อง
                    </Button>
                  </div>
                </>
              )}>
              {examRooms.map(r => <Option key={r.id} value={r.name}>{r.name}</Option>)}
            </Select>
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={scheduling} block
            style={{background:'#1e40af',borderColor:'#1e40af'}}>
            บันทึกตารางสอบ
          </Button>
        </Form>
      </Modal>

      <Modal title="รายละเอียดการสอบ" open={detailModalOpen} onCancel={() => setDetailModalOpen(false)}
        footer={<Button onClick={() => setDetailModalOpen(false)}>ปิด</Button>}>
        {selectedEvent && (
          <Space direction="vertical" style={{width:'100%'}} size={6}>
            <Text><strong>รหัสวิชา:</strong> {selectedEvent.subjectCode}</Text>
            <Text><strong>ครูผู้สอน:</strong> {selectedEvent.teacherName}</Text>
            <Text><strong>ห้องเรียน:</strong> {(selectedEvent.classLevels||[]).join(', ')}</Text>
            <Text><strong>วันที่สอบ:</strong> {selectedEvent.examDate}</Text>
            <Text><strong>เวลาสอบ:</strong> {selectedEvent.examTime}</Text>
            <Text><strong>ห้องสอบ:</strong> {selectedEvent.examRoom}</Text>
            <Text><strong>ระยะเวลา:</strong> {selectedEvent.duration} นาที</Text>
            <Text><strong>ประเภท:</strong> {selectedEvent.examType==='in-schedule'?'ในตารางสอบ':'นอกตารางสอบ'}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default App;