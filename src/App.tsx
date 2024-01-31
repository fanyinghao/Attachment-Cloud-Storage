import './App.css';
import { bitable, ITable, IFieldMeta, FieldType, IOpenAttachment } from "@lark-base-open/js-sdk";
import { Button, Form } from '@douyinfe/semi-ui';
import { BaseFormApi } from '@douyinfe/semi-foundation/lib/es/form/interface';
import { useState, useEffect, useRef, useCallback } from 'react';
import COS from 'cos-js-sdk-v5';

type IFile = {
  file_url: string;
  file_name: string;
  index_info: string;
}

export default function App() {
  const [activeTableName, setActiveTableName] = useState<string>();
  const [fieldMetaList, setFieldMetaList] = useState<IFieldMeta[]>();
  const formApi = useRef<BaseFormApi>();

  const initTable = () => {
    bitable.base.getActiveTable().then(async (table) => {
      table.getName().then(value => {
        setActiveTableName(value);
      })
    })
  }

  const off = bitable.base.onSelectionChange((event) => {
    bitable.base.getActiveTable().then(async (table) => {
      if (event?.data.tableId !== table?.id) {
        setFieldMetaList(undefined);
        initTable()
      }
    })
  })

  useEffect(() => {
    initTable()
  }, [])

  useEffect(() => {
    bitable.base.getActiveTable().then(async (table) => {
      Promise.all([table?.getFieldMetaList()])
        .then(([metaList]) => {
          const list = metaList?.filter(i => i.type === FieldType.Attachment)
          setFieldMetaList(list);
        });
    });
  }, [activeTableName]);

  const processFile = async (cos: COS, region: string, bucket: string, oTable: ITable, fieldId: string, recordId: string) => {
    let info = await getFileInfo(oTable, fieldId, recordId)


    for (let i = 0; i < info.length; i++) {
      let file = await download(info[i])
      cos.putObject({
        Bucket: region,
        Region: bucket,
        Key: `feishu_cos/${info[i].file_name}`,
        Body: file,
      }, function (err, data) {
        console.log(err || data);
      });
    }
  }

  const handleSubmit = useCallback(async (data: any) => {
    console.log('upload', data)
    const { secretId, secretKey, region, bucket, fieldId } = data;

    const oTable = await bitable.base.getActiveTable()

    let ret = await oTable?.getRecords({});
    let recordIdList = ret?.records.map(i => i.recordId);

    if (!recordIdList) return;

    const cos = new COS({
      SecretId: secretId,
      SecretKey: secretKey,
    });

    for (let i = 0; i < recordIdList.length; i++) {
      try{
        processFile(cos, region, bucket, oTable, fieldId, recordIdList[i]);
      } catch (e) {
        console.error('process', recordIdList[i], e);
      }
    }
  }, []);

  //使用getAttachmentUrls获取单元格内多附件的地址信息
  async function getFileInfo(oTable: ITable, fieldId: string, recordId: string) {
    let fileList = [];
    let oCell = (await oTable.getCellValue(fieldId, recordId)) as unknown as IOpenAttachment[];

    if(!oCell) return;

    //将oCell中的所有token压入数组中
    let oTokens = [];
    for (let j = 0; j < oCell.length; j++) {
      oTokens.push(oCell[j].token);
    }
    let oUrls = await oTable.getCellAttachmentUrls(oTokens, fieldId, recordId);
    //将每一个附件的链接地址、文件信息放到fileInfo中，并压入fileList数组中
    for (let j = 0; j < oCell.length; j++) {
      let oFileName = oCell[j].name;
      let oURL = oUrls[j];
      //将获得的URL、文件名、索引字符串信息存放到一个文件对象中
      let fileInfo = { file_url: "", file_name: "", index_info: "" };
      fileInfo.file_url = oURL;
      fileInfo.file_name = oFileName;
      fileList.push(fileInfo);
    }
    return fileList;
  }

  async function download(iFile: IFile) {
    let url = iFile.file_url;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    } else {
      return await response.blob();
    }
  }

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
        <Form.Input field='region' label='COS Region' trigger='blur' style={{ width: '100%' }} placeholder='Region' />
        <Form.Input field='bucket' label='COS Bucket' trigger='blur' style={{ width: '100%' }} placeholder='Bucket' />
        <div>
          <Button theme='solid' htmlType='submit'>上传到腾讯云COS</Button>
        </div>
      </Form>
    </main>
  )
}