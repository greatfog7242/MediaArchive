import { RecordEditForm, type RecordFormData } from "../[id]/edit/RecordEditForm";

const emptyRecord: RecordFormData = {
  title: "",
  series: null,
  reporter: null,
  filmReel: null,
  reelSegment: null,
  date: "",
  accessCopy: null,
  kalturaId: null,
  embedCode: null,
  viewOnline: null,
  startTime: null,
  stopTime: null,
};

export default function CreateRecordPage() {
  return <RecordEditForm record={emptyRecord} mode="create" />;
}
