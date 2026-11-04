// Giá trị enum lưu trên bản ghi (config/entities) ↔ kiểu trong domain. Module và Code step dùng chung.
import type { ContractKind, LineType } from './lines';

export const LINE_TYPE_OF_CODE: Record<string, LineType> = {
  tb: 'TB', lic: 'LIC', lic_dk: 'LIC-DK', lic_ntnn: 'LIC-NTNN', dvtk_i: 'DVTK-I', dvtk_o: 'DVTK-O', dvdk_i: 'DVDK-I', dvdk_o: 'DVDK-O',
  dvdk_ntnn: 'DVDK-NTNN', cloud_server: 'Cloud Server', colocation: 'Colocation', veeam: 'Veeam', manage_service: 'Manage Service',
  other_services: 'Other Services',
};
export const LINE_CODES = Object.keys(LINE_TYPE_OF_CODE);

export const CONTRACT_KIND_OF_CODE: Record<string, ContractKind> = {
  thuong_mai: 'Thương Mại', license_runrate: 'License/Runrate', dv_loai_1: 'Dịch vụ Loại I', dv_loai_2: 'Dịch vụ Loại II',
  fulfillment: 'Fulfillment',
};
export const CODE_OF_CONTRACT_KIND = Object.fromEntries(
  Object.entries(CONTRACT_KIND_OF_CODE).map(([code, kind]) => [kind, code]),
) as Record<ContractKind, string>;
