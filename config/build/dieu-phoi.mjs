// Workflow điều phối (spec §11.2): chạy khi một task đổi sang xong / trả lại / không áp dụng, tính lại việc cần làm
// bằng Code step `dieu_phoi` (src/code/dieu-phoi.ts), rồi mở task mới, hủy task, ghi trạng thái đơn và chốt P&L.
import {
  NOBODY, NOW, bind, code, create, decision, edges, end, flt, getById, graph, lit, node, otherwise, readParameters, ref, search,
  servicePrincipal, setvar, start, tpl, update, upsert, when, workflow,
} from "@reflexify/agentflow-app-builder/workflow";

const TASK = "${entity:task}";
const DON = "${entity:don_hang}";
const DONG = "${entity:dong_hang}";
const GIA = "${entity:gia_ban_dong}";
const TC = "${entity:tai_chinh_don}";
const CH = "${entity:cau_hinh}";
const TOMTAT = "${entity:tom_tat_don}";
const LICHSU = "${entity:lich_su}";
const CUA_DON = (field = "don_hang") => [flt(field, "eq", ref("subject.record.don_hang"))];
const OUT = "nodes.tinh.output";

const moTask = node("mo_task", "Mở các task mới", "for_each", {
  listSource: `${OUT}.tao`, itemAlias: "t", mode: "sequential", continueOnItemFailure: false, failOnItemFailure: true,
  body: {
    schemaVersion: "1.0", start: "ms", end: ["me"],
    nodes: [
      node("ms", "Task", "start", {}),
      create("tao", "Tạo task", TASK, [
        bind("don_hang", ref("input.t.don_hang")), bind("ma", ref("input.t.ma")), bind("vai_tro", ref("input.t.vai_tro")),
        bind("trang_thai", ref("input.t.trang_thai")), bind("am", ref("input.t.am")), bind("is", ref("input.t.is")),
        bind("nhom", ref("input.t.nhom")), bind("han", tpl("{{ add_business_days(now(), input.t.sla_ngay) }}")),
      ]),
      node("me", "Xong", "end", {}),
    ],
    edges: edges(["me0", "ms", "tao"], ["me1", "tao", "me"]),
  },
});

const capNhat = node("cap_nhat", "Cập nhật task", "for_each", {
  listSource: `${OUT}.cap_nhat`, itemAlias: "u", mode: "sequential", continueOnItemFailure: false, failOnItemFailure: true,
  body: {
    schemaVersion: "1.0", start: "us", end: ["ue"],
    nodes: [
      node("us", "Task", "start", {}),
      update("doi", "Đổi trạng thái task", TASK, "input.u.id", [bind("trang_thai", ref("input.u.trang_thai"))]),
      node("ue", "Xong", "end", {}),
    ],
    edges: edges(["ue0", "us", "doi"], ["ue1", "doi", "ue"]),
  },
});

const ghiTomTat = node("ghi_tom_tat", "Ghi bản tóm tắt cho TM / PROC", "for_each", {
  listSource: `${OUT}.tom_tat`, itemAlias: "x", mode: "sequential", continueOnItemFailure: false, failOnItemFailure: true,
  body: {
    schemaVersion: "1.0", start: "ts", end: ["te"],
    nodes: [
      node("ts", "Tóm tắt", "start", {}),
      upsert("luu", "Ghi tóm tắt", TOMTAT, "theo_don_phan", [
        bind("don_hang", ref("input.x.don_hang")), bind("phan", ref("input.x.phan")),
        bind("du_lieu", ref("input.x.du_lieu")), bind("nhom_xem", ref("input.x.nhom_xem")),
      ]),
      node("te", "Xong", "end", {}),
    ],
    edges: edges(["te0", "ts", "luu"], ["te1", "luu", "te"]),
  },
});

const ghiLichSu = node("ghi_lich_su", "Ghi lịch sử", "for_each", {
  listSource: `${OUT}.lich_su`, itemAlias: "h", mode: "sequential", continueOnItemFailure: false, failOnItemFailure: true,
  body: {
    schemaVersion: "1.0", start: "hs", end: ["he"],
    nodes: [
      node("hs", "Lịch sử", "start", {}),
      create("them", "Thêm một dòng lịch sử", LICHSU, [
        bind("don_hang", ref("input.h.don_hang")), bind("thoi_gian", NOW), bind("nguoi", ref("parent.vars.nguoi_lam")),
        bind("hanh_dong", ref("input.h.hanh_dong")), bind("task", ref("input.h.task")), bind("ghi_chu", ref("input.h.ghi_chu")), bind("sau", ref("input.h.sau")),
      ]),
      node("he", "Xong", "end", {}),
    ],
    edges: edges(["he0", "hs", "them"], ["he1", "them", "he"]),
  },
});

export const workflows = {
  dieu_phoi: workflow(
    "dieu_phoi", "Điều phối quy trình đơn hàng",
    "Khi một task xong, bị trả lại hoặc không áp dụng: mở các task đủ tiền đề, hủy task khi trả lại, ghi trạng thái đơn và chốt P&L.",
    servicePrincipal("tu_dong_principal"), NOBODY,
    graph("Điều phối quy trình đơn hàng", [
      start({ subject: TASK }),
      readParameters("nhom_tm", "nhom_proc", "nhom_sd", "nhom_acc"),
      setvar("nguoi", "Người vừa thao tác", [["nguoi_lam", ref("trigger.actor_user_id")]]),
      getById("don", "Đọc đơn", DON, "subject.record.don_hang"),
      search("tasks", "Task của đơn", TASK, CUA_DON(), { limit: 500 }),
      search("dong", "Dòng hàng", DONG, CUA_DON(), { limit: 1000 }),
      search("gia", "Giá bán", GIA, CUA_DON(), { limit: 1000 }),
      search("tc", "Tài chính đơn", TC, CUA_DON(), { limit: 1 }),
      search("ch", "Cấu hình", CH, [flt("ten", "eq", lit("mac_dinh"))], { limit: 1 }),
      code("tinh", "Tính việc cần làm", "code/dieu-phoi.js", [
        ["don", ref("nodes.don.output.record")], ["tasks", ref("nodes.tasks.output.records")],
        ["dong", ref("nodes.dong.output.records")], ["gia_ban", ref("nodes.gia.output.records")],
        ["tai_chinh", ref("nodes.tc.output.records")], ["cau_hinh", ref("nodes.ch.output.records")],
        ["nhom_tm", ref("vars.nhom_tm")], ["nhom_proc", ref("vars.nhom_proc")],
        ["nhom_sd", ref("vars.nhom_sd")], ["nhom_acc", ref("vars.nhom_acc")],
      ], {
        type: "object",
        properties: {
          tao: { type: "array" }, cap_nhat: { type: "array" }, don: { type: "object" }, chot: { type: ["object", "null"] },
          tom_tat: { type: "array" }, lich_su: { type: "array" },
        },
        required: ["tao", "cap_nhat", "don", "chot", "tom_tat", "lich_su"],
      }),
      capNhat,
      moTask,
      update("ghi_don", "Ghi trạng thái đơn", DON, "subject.record.don_hang", [
        bind("trang_thai", ref(`${OUT}.don.trang_thai`)), bind("giai_doan", ref(`${OUT}.don.giai_doan`)),
        bind("co_dich_vu", ref(`${OUT}.don.co_dich_vu`)), bind("co_hang_hoa", ref(`${OUT}.don.co_hang_hoa`)),
        bind("ky_thuat", ref(`${OUT}.don.ky_thuat`)), bind("mua_hang", ref(`${OUT}.don.mua_hang`)),
        bind("nguoi_duoc_chia", ref(`${OUT}.don.nguoi_duoc_chia`)), bind("ly_do_gui", ref(`${OUT}.don.ly_do_gui`)),
      ]),
      ghiTomTat,
      ghiLichSu,
      decision("can_chot", "Có chốt P&L?", [when("e_chot", { "!!": [{ var: `${OUT}.chot` }] }), otherwise("e_khong_chot")]),
      update("chot", "Chốt P&L", TC, "nodes.tc.output.records[0].id", [
        bind("pl_chot", ref(`${OUT}.chot.pl_chot`)), bind("cau_hinh_chot", ref(`${OUT}.chot.cau_hinh_chot`)),
        bind("ln_thuan_chot", ref(`${OUT}.chot.ln_thuan_chot`)), bind("dat_chot", ref(`${OUT}.chot.dat_chot`)), bind("chot_luc", NOW),
      ]),
      end("xong_chot", "Đã chốt", "chot"),
      end("xong", "Xong", "xong"),
    ], edges(
      ["e_start", "start", "params"], ["e_params", "params", "nguoi"], ["e_nguoi", "nguoi", "don"], ["e_don", "don", "tasks"], ["e_tasks", "tasks", "dong"],
      ["e_dong", "dong", "gia"], ["e_gia", "gia", "tc"], ["e_tc", "tc", "ch"], ["e_ch", "ch", "tinh"],
      ["e_tinh", "tinh", "cap_nhat"], ["e_cap_nhat", "cap_nhat", "ghi_don"], ["e_ghi_don_mo", "ghi_don", "mo_task"],
      ["e_mo_task", "mo_task", "ghi_tom_tat"], ["e_tom_tat", "ghi_tom_tat", "ghi_lich_su"], ["e_lich_su", "ghi_lich_su", "can_chot"], ["e_chot", "can_chot", "chot"], ["e_khong_chot", "can_chot", "xong"],
      ["e_da_chot", "chot", "xong_chot"],
    )),
  ),
};

// Chỉ người làm task tạo ra các trạng thái này; workflow chỉ ghi dang_lam / bo_qua / xong (tạo mới) và huy, nên không tự gọi lại.
export const triggers = {
  dieu_phoi: {
    workflow: "dieu_phoi",
    kind: "entity_record",
    config: {
      entity_id: TASK, change_kind: "updated", input_mappings: [],
      filter: { and: [
        { in: ["trang_thai", { var: "event.changed" }] },
        { in: [{ var: "trang_thai" }, ["xong", "tra_lai", "khong_ap_dung"]] },
      ] },
      group: { by: { kind: "field", field: "don_hang" } },
    },
  },
};

export const actions = {};
