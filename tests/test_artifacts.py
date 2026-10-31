import unittest
import zipfile
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT=Path(__file__).resolve().parents[1]
class ArtifactTests(unittest.TestCase):
    def test_xaml_and_embedded_code_match(self):
        root=ET.parse(ROOT/'uipath/PitStopAutomation.xaml').getroot()
        invoke=root.find('.//{http://schemas.uipath.com/workflow/activities}InvokeCode')
        self.assertEqual(invoke.attrib['Code'],(ROOT/'uipath/ValidateAndRecord.vb').read_text())
    def test_empty_excel_template(self):
        with zipfile.ZipFile(ROOT/'uipath/PitStop_Execution_Log.xlsx') as archive:
            self.assertIsNone(archive.testzip())
            for name in archive.namelist(): ET.fromstring(archive.read(name))
            sheet=ET.fromstring(archive.read('xl/worksheets/sheet1.xml'))
            ns={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
            self.assertEqual(len(sheet.findall('.//s:row',ns)),1)
            self.assertEqual(len(sheet.findall('.//s:c',ns)),11)
if __name__=='__main__': unittest.main()
