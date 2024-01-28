import './App.css';
import { bitable, ITable, IFieldMeta, FieldType } from "@lark-base-open/js-sdk";
import { Button, Form } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { useState, useEffect, useRef, useCallback } from 'react';
import COS from 'cos-nodejs-sdk-v5';

export default function App() {
  const [activeTable, setActiveTable] = useState<ITable>();
  const [activeTableName, setActiveTableName] = useState<string>();
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>();
  const formApi = useRef<BaseFormApi>();

  const initTable = () => {
    bitable.base.getActiveTable().then(async (table) => {
      setActiveTable(table);
      table.getName().then(value => {
        setActiveTableName(value);
      })
    })
  }

  const off = bitable.base.onSelectionChange((event) => {
    if (!activeTable) return;
    if (event?.data.tableId !== activeTable?.id) {
      setFieldMetaList(undefined);
      initTable()
    }
  })

  useEffect(() => {
    initTable()
  }, [])

  useEffect(() => {
    Promise.all([activeTable?.getFieldMetaList()])
      .then(([metaList]) => {
        const list = metaList?.filter(i => i.type === FieldType.Attachment)
        setFieldMetaList(list);
      });
  }, [activeTable]);

  const cos = new COS({
    SecretId: process.env.SecretId,
    SecretKey: process.env.SecretKey,
  });

  const handleSubmit = useCallback(async (data: any) => {
    console.log('upload', data)
  }, []);

  return (
    <main className="main">
      <Form labelPosition='top' onSubmit={handleSubmit} getFormApi={(baseFormApi: BaseFormApi) => formApi.current = baseFormApi}>
        <Form.Label>Current Table: {activeTableName}</Form.Label>
        {fieldMetaList && <Form.Select field='fieldId' label='Select Field' placeholder="Please select a Field" style={{ width: '100%' }}>
          {
            Array.isArray(fieldMetaList) && fieldMetaList.map(({ name, id }) => {
              return (
                <Form.Select.Option key={id} value={id}>
                  {name}
                </Form.Select.Option>
              );
            })
          }
        </Form.Select>}
        <Form.Input mode="password" field='secretId' label='COS SecretId' trigger='blur' style={{ width: '100%' }} placeholder='SecretId' />
        <Form.Input mode="password" field='secretKey' label='COS SecretKey' trigger='blur' style={{ width: '100%' }} placeholder='SecretKey' />
        <div>
          <Button theme='solid' htmlType='submit'>上传到腾讯云COS</Button>
        </div>
      </Form>
    </main>
  )
}