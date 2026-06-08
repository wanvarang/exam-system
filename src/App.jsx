content: import React, { useState, useEffect, useRef } from 'react';
import {
  Form, Select, Button, Card, message, Spin, Slider, InputNumber,
  Tabs, Table, Tag, Badge, Space, Typography, Divider, Input,
  Modal, TimePicker, DatePicker, Alert
} from 'antd';
import {
  FormOutlined, UnorderedListOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CalendarOutlined, DragOutlined
} from '@ant-design/icons';
import FullCalendar from '@fullcalendar/react';
import timeGridPlugin from '@fullcalendar/timegrid';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin, { Draggable } from '@fullcalendar/interaction';
import { db } from './firebase-config';
import {
  collection, getDocs, addDoc, updateDoc, doc,
  orderBy, query, onSnapshot
} from 'firebase/firestore';
import dayjs from 'dayjs';
import './index.css';

const { Option } = Select;
const { Title, Text } = Typography;

const GRADE_COLORS = {
  'ม.1': '#ef4444', 'ม.2': '#f97316', 'ม.3': '#eab308',
  'ม.4': '#22c55e', 'ม.5': '#3b82f6', 'ม.6': '#a855f7',
};

const GRADES = ['ม.1', 'ม.2', 'ม.3', 'ม.4', 'ม.5', 'ม.6'];

const STATUS_CONFIG = {
  pending:  { label: 'รอดำเนินการ', color: 'orange' },
  approved: { label: 'อนุมัติแล้ว',  color: 'green'  },
  rejected: { label: 'ปฏิเสธ',       color: 'red'    },
};

function getEventColor(classLevels) {
  if (!classLevels || classLevels.length === 0) return '#6b7280';
  for (const g of GRADES) {
    if (classLevels.some(c => c.startsWith(g))) return GRADE_COLORS[g];
  }
  return '#6b7280';
}

function getGradeFromLevels(classLevels) {
  if (!classLevels) return null;
  for (const g of GRADES) {
    if (classLevels.some(c => c.startsWith(g))) return g;
  }
  return null;
}

const App = () => {
  const [form] = Form.useForm();
  const [confirmForm] = Form.useForm();
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('form');
  const [requests, setRequests] = useState([]);
  const [durationValue, setDurationValue] = useState(60);
  const [gradeFilter, setGradeFilter] = useState('ทั้งหมด');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [pendingSchedule, setPendingSchedule] = useState(null);
  const [scheduling, setScheduling] = useState(false);
  const [conflicts, setConflicts] = useState([]);
  const draggableContainerRef = useRef(null);

  useEffect(() => {
    getDocs(collection(db, 'subjects')).then(snap => {
      setSubjects(snap.docs.map(d => ({
        code: d.data().subject_code || d.data().code,
        name: d.data().subject_name || d.data().name,
      })));
    }).catch(() => message.error('ไม่สามารถโหลดรายวิชาได้'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'Exam_Requests'), orderBy('timestamp', 'desc'));
    return onSnapshot(q, snap => {
      setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }, []);

  // Init FullCalendar external draggable
  useEffect(() => {
    if (!draggableContainerRef.current) return;
    const draggable = new Draggable(draggableContainerRef.current, {
      itemSelector: '.fc-draggable-item',
      eventData: (el) => {
        const data = JSON.parse(el.getAttribute('data-event') || '{}');
        return {
          title: data.title,
          duration: { minutes: data.duration || 60 },
          extendedProps: data,
          create: false,
        };
      },
    });
    return () => draggable.destroy();
  }, [activeTab]);

  const generateClassOptions = () => {
    return GRADES.map(level => (
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

  const filteredPending = gradeFilter === 'ทั้งหมด'
    ? pendingRequests
    : pendingRequests.filter(r => (r.classLevels || []).some(c => c.startsWith(gradeFilter)));

  const filteredApproved = gradeFilter === 'ทั้งหมด'
    ? approvedRequests
    : approvedRequests.filter(r => (r.classLevels || []).some(c => c.startsWith(gradeFilter)));

  // Suggest next available time on a given date
  const suggestStartTime = (dateStr, droppedTime) => {
    const dayEvents = approvedRequests.filter(r => r.examDate === dateStr);
    if (dayEvents.length === 0) return droppedTime;
    const lastEnd = dayEvents.reduce((latest, r) => {
      const end = dayjs(`${r.examDate} ${r.examTime}`, 'YYYY-MM-DD HH:mm')
        .add(r.duration || 60, 'minute').add(5, 'minute');
      return end.isAfter(latest) ? end : latest;
    }, dayjs(`${dateStr} 00:00`, 'YYYY-MM-DD HH:mm'));
    return lastEnd.format('HH:mm');
  };

  // Detect conflicts: same classLevel at overlapping times on same day
  const detectConflicts = (requestId, dateStr, startTime, duration) => {
    const newStart = dayjs(`${dateStr} ${startTime}`, 'YYYY-MM-DD HH:mm');
    const newEnd = newStart.add(duration || 60, 'minute');
    const newReq = requests.find(r => r.id === requestId);
    if (!newReq) return [];
    const found = [];
    for (const r of approvedRequests) {
      if (r.examDate !== dateStr) continue;
      const rStart = dayjs(`${r.examDate} ${r.examTime}`, 'YYYY-MM-DD HH:mm');
      const rEnd = rStart.add(r.duration || 60, 'minute');
      const overlaps = newStart.isBefore(rEnd) && newEnd.isAfter(rStart);
      if (!overlaps) continue;
      const sharedClasses = (newReq.classLevels || []).filter(c => (r.classLevels || []).includes(c));
      if (sharedClasses.length > 0) {
        found.push(`${r.subjectCode} (${sharedClasses.join(', ')})`);
      }
    }
    return found;
  };

  const handleExternalDrop = (info) => {
    const data = info.draggedEl.getAttribute('data-event');
    if (!data) return;
    const reqData = JSON.parse(data);
    const dateStr = dayjs(info.date).format('YYYY-MM-DD');
    const droppedTime = dayjs(info.date).format('HH:mm');
    const suggested = suggestStartTime(dateStr, droppedTime);
    const c = detectConflicts(reqData.id, dateStr, suggested, reqData.duration);
    setConflicts(c);
    setPendingSchedule({ ...reqData, dateStr, suggestedTime: suggested });
    confirmForm.setFieldsValue({
      examDate: dayjs(dateStr),
      examTime: dayjs(`${dateStr} ${suggested}`, 'YYYY-MM-DD HH:mm'),
    });
    setConfirmOpen(true);
  };

  const handleConfirmSchedule = async (values) => {
    if (!pendingSchedule) return;
    setScheduling(true);
    try {
      await updateDoc(doc(db, 'Exam_Requests', pendingSchedule.id), {
        examDate: values.examDate.format('YYYY-MM-DD'),
        examTime: values.examTime.format('HH:mm'),
        status: 'approved',
      });
      message.success('จัดตารางสอบเรียบร้อย!');
      setConfirmOpen(false);
      setConflicts([]);
    } catch {
      message.error('ไม่สามารถบันทึกตารางสอบได้');
    } finally {
      setScheduling(false);
    }
  };

  // Calendar events
  const calendarEvents = filteredApproved.map(r => {
    const start = dayjs(`${r.examDate} ${r.examTime}`, 'YYYY-MM-DD HH:mm');
    const end = start.add(r.duration || 60, 'minute');
    return {
      id: r.id,
      title: `${r.subjectCode} (${(r.classLevels || []).join(',')})`,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: getEventColor(r.classLevels),
      borderColor: getEventColor(r.classLevels),
      extendedProps: r,
    };
  });

  const adminColumns = [
    { title: 'รหัสวิชา', dataIndex: 'subjectCode', key: 'subjectCode', width: 110 },
    { title: 'ชื่อครู', dataIndex: 'teacherName', key: 'teacherName', width: 130 },
    { title: 'ห้องเรียน', dataIndex: 'classLevels', key: 'classLevels',
      render: val => <Space wrap size={4}>{(val||[]).map(c=><Tag key={c} color="blue">{c}</Tag>)}</Space> },
    { title: 'ระยะเวลา', dataIndex: 'duration', key: 'duration', width: 100, render: v => `${v} นาที` },
    { title: 'ประเภท', dataIndex: 'examType', key: 'examType', width: 120, render: v => v==='in-schedule'?'ในตาราง':'นอกตาราง' },
    { title: 'วันสอบ', dataIndex: 'examDate', key: 'examDate', width: 110 },
    { title: 'เวลา', dataIndex: 'examTime', key: 'examTime', width: 80 },
    { title: 'สถานะ', dataIndex: 'status', key: 'status', width: 130,
      render: (status, record) => (
        <Select value={status} size="small" style={{width:120}} onChange={val=>handleStatusChange(record.id,val)}>
          {Object.entries(STATUS_CONFIG).map(([key,cfg])=>(
            <Option key={key} value={key}><Tag color={cfg.color} style={{margin:0}}>{cfg.label}</Tag></Option>
          ))}
        </Select>
      )},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-6">
          <Title level={2} style={{color:'#1e3a8a',marginBottom:4}}>ระบบสำรวจเวลาสอบ</Title>
          <Text type="secondary">โรงเรียนบ้านมิ — บันทึกและจัดการคำขอสอบ</Text>
        </div>
        <Card className="shadow-xl rounded-2xl" styles={{body:{padding:'0 0 24px'}}}>
          <Tabs activeKey={activeTab} onChange={setActiveTab} size="large"
            tabBarStyle={{paddingLeft:24,paddingRight:24,marginBottom:0}}
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
                            {subjects.map(s=><Option key={s.code} value={s.code}>{s.code} — {s.name}</Option>)}
                          </Select>
                        </Form.Item>
                        <Form.Item name="classLevels" label="ระดับชั้นและห้องที่สอบ" rules={[{required:true,message:'กรุณาเลือกห้องเรียน'}]}>
                          <Select mode="multiple" placeholder="เลือกห้องเรียน (เลือกได้หลายห้อง)">{generateClassOptions()}</Select>
                        </Form.Item>
                        <Form.Item label={`เวลาที่ใช้สอบ — ${durationValue} นาที`}>
                          <div style={{display:'flex',alignItems:'center',gap:16}}>
                            <Slider min={30} max={180} step={15} value={durationValue} style={{flex:1}}
                              marks={{30:'30',60:'60',90:'90',120:'120',150:'150',180:'180'}}
                              onChange={val=>setDurationValue(val)} />
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
                    <Table columns={adminColumns} dataSource={requests} rowKey="id"
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
                    {/* Grade filter */}
                    <Space wrap style={{marginBottom:12}}>
                      {['ทั้งหมด',...GRADES].map(g => (
                        <Button key={g} size="small"
                          type={gradeFilter===g?'primary':'default'}
                          style={gradeFilter!==g && GRADE_COLORS[g] ? {borderColor:GRADE_COLORS[g],color:GRADE_COLORS[g]} : {}}
                          onClick={()=>setGradeFilter(g)}>
                          {g}
                        </Button>
                      ))}
                    </Space>

                    <div style={{display:'flex',gap:16,alignItems:'flex-start'}}>
                      {/* Sidebar */}
                      <div style={{width:260,flexShrink:0}}>
                        <Card size="small" title={
                          <span><DragOutlined /> ลากไปวางบน Calendar ({filteredPending.length})</span>
                        } style={{maxHeight:'70vh',overflow:'auto'}}>
                          {filteredPending.length===0
                            ? <Text type="secondary" style={{fontSize:12}}>ไม่มีคำขอที่รอดำเนินการ</Text>
                            : <div ref={draggableContainerRef}>
                                {filteredPending.map(r => {
                                  const grade = getGradeFromLevels(r.classLevels);
                                  const color = getEventColor(r.classLevels);
                                  const eventData = JSON.stringify({
                                    id: r.id, title: `${r.subjectCode}`,
                                    duration: r.duration || 60,
                                    subjectCode: r.subjectCode,
                                    teacherName: r.teacherName,
                                    classLevels: r.classLevels,
                                  });
                                  return (
                                    <div key={r.id} className="fc-draggable-item"
                                      data-event={eventData}
                                      style={{
                                        background: color+'22', border:`2px solid ${color}`,
                                        borderRadius:6, padding:'6px 8px', marginBottom:6,
                                        cursor:'grab', userSelect:'none',
                                      }}>
                                      <div style={{fontWeight:600,fontSize:13,color}}>{r.subjectCode}</div>
                                      <div style={{fontSize:11,color:'#555'}}>{r.teacherName}</div>
                                      <div style={{marginTop:2}}>
                                        <Space wrap size={2}>
                                          {(r.classLevels||[]).map(c=>(
                                            <Tag key={c} style={{fontSize:10,margin:1,padding:'0 4px',background:color+'33',border:`1px solid ${color}`,color}}>{c}</Tag>
                                          ))}
                                        </Space>
                                      </div>
                                      <div style={{fontSize:11,color:'#888',marginTop:2}}>{r.duration||60} นาที</div>
                                    </div>
                                  );
                                })}
                              </div>
                          }
                        </Card>
                      </div>

                      {/* Calendar */}
                      <div style={{flex:1,minWidth:0}}>
                        <FullCalendar
                          plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
                          initialView="timeGridWeek"
                          headerToolbar={{
                            left: 'prev,next today',
                            center: 'title',
                            right: 'timeGridWeek,dayGridMonth',
                          }}
                          locale="th"
                          buttonText={{today:'วันนี้',week:'สัปดาห์',month:'เดือน'}}
                          slotMinTime="06:00:00"
                          slotMaxTime="20:00:00"
                          slotDuration="00:15:00"
                          slotLabelInterval="01:00:00"
                          allDaySlot={false}
                          editable={false}
                          droppable={true}
                          drop={handleExternalDrop}
                          events={calendarEvents}
                          eventClick={(info) => {
                            setSelectedEvent(info.event.extendedProps);
                            setDetailOpen(true);
                          }}
                          height="auto"
                          eventTimeFormat={{hour:'2-digit',minute:'2-digit',hour12:false}}
                        />
                      </div>
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </div>

      {/* Confirm Schedule Modal */}
      <Modal title="ยืนยันการจัดตารางสอบ" open={confirmOpen}
        onCancel={()=>{setConfirmOpen(false);setConflicts([]);}} footer={null} destroyOnClose>
        {pendingSchedule && (
          <>
            <div style={{background:'#f0f9ff',borderRadius:8,padding:'10px 14px',marginBottom:12}}>
              <Text strong>{pendingSchedule.subjectCode}</Text>
              <Text style={{marginLeft:8,color:'#555'}}>{pendingSchedule.teacherName}</Text>
              <div style={{marginTop:4}}>
                <Space wrap size={2}>
                  {(pendingSchedule.classLevels||[]).map(c=>(
                    <Tag key={c} color="blue" style={{fontSize:11}}>{c}</Tag>
                  ))}
                </Space>
              </div>
              <div style={{color:'#888',fontSize:12,marginTop:4}}>{pendingSchedule.duration} นาที · เวลาที่แนะนำ {pendingSchedule.suggestedTime}</div>
            </div>
            {conflicts.length>0 && (
              <Alert type="warning" showIcon style={{marginBottom:12}}
                message="พบการซ้อนทับของห้องเรียน"
                description={`ห้องเรียนซ้ำกับ: ${conflicts.join(', ')}`} />
            )}
            <Form form={confirmForm} layout="vertical" onFinish={handleConfirmSchedule}>
              <Form.Item name="examDate" label="วันที่สอบ" rules={[{required:true}]}>
                <DatePicker style={{width:'100%'}} format="DD/MM/YYYY" />
              </Form.Item>
              <Form.Item name="examTime" label="เวลาเริ่มสอบ" rules={[{required:true}]}>
                <TimePicker format="HH:mm" minuteStep={5} style={{width:'100%'}} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={scheduling} block
                style={{background:'#1e40af',borderColor:'#1e40af'}}>
                บันทึกตารางสอบ
              </Button>
            </Form>
          </>
        )}
      </Modal>

      {/* Detail Modal */}
      <Modal title="รายละเอียดการสอบ" open={detailOpen}
        onCancel={()=>setDetailOpen(false)}
        footer={<Button onClick={()=>setDetailOpen(false)}>ปิด</Button>}>
        {selectedEvent && (
          <Space direction="vertical" style={{width:'100%'}} size={6}>
            <Text><strong>รหัสวิชา:</strong> {selectedEvent.subjectCode}</Text>
            <Text><strong>ครูผู้สอน:</strong> {selectedEvent.teacherName}</Text>
            <Text><strong>ห้องเรียน:</strong> {(selectedEvent.classLevels||[]).join(', ')}</Text>
            <Text><strong>วันที่สอบ:</strong> {selectedEvent.examDate}</Text>
            <Text><strong>เวลาสอบ:</strong> {selectedEvent.examTime}</Text>
            <Text><strong>ระยะเวลา:</strong> {selectedEvent.duration} นาที</Text>
            <Text><strong>ประเภท:</strong> {selectedEvent.examType==='in-schedule'?'ในตารางสอบ':'นอกตารางสอบ'}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default App;

file_path: /home/user/exam-system/src/App.jsx

File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.