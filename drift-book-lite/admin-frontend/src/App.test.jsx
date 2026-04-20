import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGet, mockPost, mockPatch, mockPut, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      patch: mockPatch,
      put: mockPut,
      delete: mockDelete,
    }),
  },
}));

// Import pages directly to avoid localStorage / AdminGuard complexity
import { AdminLoginPage } from "./pages/AdminLoginPage.jsx";
import { BooksPage } from "./pages/BooksPage.jsx";
import { ReviewsPage } from "./pages/ReviewsPage.jsx";
import { FeaturedReviewsPage } from "./pages/FeaturedReviewsPage.jsx";
import { SensitiveWordsPage } from "./pages/SensitiveWordsPage.jsx";
import { AssetsPage } from "./pages/AssetsPage.jsx";
import { StudentRosterPage } from "./pages/StudentRosterPage.jsx";
import App from "./App.jsx";

const TOKEN = "test-token";
const NOOP = vi.fn();
const ADMIN_TOKEN_KEY = "drift-book-admin-token";
const assetsResponse = {
  id: 1,
  schoolLogoPath: "/uploads/site-assets/school-logo.jpg",
  carouselImages: [
    {
      id: "slide-1",
      path: "/uploads/site-assets/carousel-01.jpg",
      enabled: true,
      sortOrder: 0,
      label: "校园轮播 1",
    },
  ],
  processContent: [],
  defaultSiteAssetsDir: "/tmp/default-site-assets",
};
const defaultResourcesResponse = {
  resources: {
    bookCatalog: {
      path: "/tmp/resources/default-book-catalog/图书馆7楼流通室数据.xlsx",
      exists: true,
      bookCount: 1,
    },
    studentRoster: {
      path: "/tmp/resources/default-student-roster/2025学年学生信息.xls",
      exists: true,
      studentCount: 1,
    },
    sensitiveWords: {
      path: "/tmp/resources/default-sensitive-words",
      exists: true,
      wordCount: 12,
    },
    siteAssets: {
      path: "/tmp/default-site-assets",
      exists: true,
    },
  },
};

function wrap(ui, path = "/") {
  return render(<MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>);
}

// ─── AdminLoginPage ──────────────────────────────────────────────────────────

describe("AdminLoginPage", () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  test("renders username/password fields and submit button", () => {
    wrap(<AdminLoginPage />);

    expect(screen.getByText("Admin Access")).toBeInTheDocument();
    expect(screen.getByText("管理员登录")).toBeInTheDocument();
    expect(screen.getByText(/管理书目/)).toBeInTheDocument();
    expect(screen.getByLabelText(/用户名/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/密码/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "进入后台" })).toBeInTheDocument();
  });

  test("shows error message on login failure", async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: "用户名或密码错误" } },
    });

    wrap(<AdminLoginPage />);

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "进入后台" }));

    expect(await screen.findByText("用户名或密码错误")).toBeInTheDocument();
  });

  test("calls /admin/login with form values", async () => {
    mockPost.mockResolvedValue({ data: { token: TOKEN } });

    wrap(<AdminLoginPage />);

    const user = userEvent.setup();
    const usernameInput = screen.getByLabelText(/用户名/i);
    const passwordInput = screen.getByLabelText(/密码/i);

    await user.clear(usernameInput);
    await user.type(usernameInput, "admin1");
    await user.clear(passwordInput);
    await user.type(passwordInput, "secret");

    await user.click(screen.getByRole("button", { name: "进入后台" }));

    expect(mockPost).toHaveBeenCalledWith(
      "/admin/login",
      expect.objectContaining({ username: "admin1", password: "secret" })
    );
  });
});

// ─── Account settings route ─────────────────────────────────────────────────

describe("Account settings", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    window.localStorage.setItem(ADMIN_TOKEN_KEY, TOKEN);
    window.history.pushState({}, "", "/settings");
    mockGet.mockReset();
    mockPost.mockReset();
    mockPatch.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/books") return Promise.resolve({ data: booksResponse });
      if (path === "/admin/imports") return Promise.resolve({ data: { batches: [] } });
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("renders password change fields", async () => {
    render(<App />);

    expect(await screen.findByLabelText("当前密码")).toBeInTheDocument();
    expect(screen.getByLabelText("新密码")).toBeInTheDocument();
    expect(screen.getByLabelText("确认新密码")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "更新密码" })).toBeInTheDocument();
  });

  test("does not submit when password confirmation does not match", async () => {
    render(<App />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("当前密码"), "jyzx2026");
    await user.type(screen.getByLabelText("新密码"), "new-admin-password");
    await user.type(screen.getByLabelText("确认新密码"), "different-password");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    expect(mockPatch).not.toHaveBeenCalled();
    expect(await screen.findByText("两次输入的新密码不一致。")).toBeInTheDocument();
  });

  test("clears the token and returns to login after password change", async () => {
    mockPatch.mockResolvedValue({ data: { message: "密码已更新，请重新登录" } });
    render(<App />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("当前密码"), "jyzx2026");
    await user.type(screen.getByLabelText("新密码"), "new-admin-password");
    await user.type(screen.getByLabelText("确认新密码"), "new-admin-password");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/me/password",
        {
          currentPassword: "jyzx2026",
          newPassword: "new-admin-password",
        },
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        })
      );
    });
    expect(window.localStorage.getItem(ADMIN_TOKEN_KEY)).toBeNull();
    expect(await screen.findByText("密码已更新，请使用新密码登录。")).toBeInTheDocument();
  });

  test("shows api errors when password change fails", async () => {
    mockPatch.mockRejectedValue({
      response: { data: { message: "当前密码错误" } },
    });
    render(<App />);

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("当前密码"), "wrong-password");
    await user.type(screen.getByLabelText("新密码"), "new-admin-password");
    await user.type(screen.getByLabelText("确认新密码"), "new-admin-password");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    expect(await screen.findByText("当前密码错误")).toBeInTheDocument();
  });
});

// ─── BooksPage ───────────────────────────────────────────────────────────────

const booksResponse = {
  books: [
    {
      id: "b1",
      title: "漂流书目",
      author: "某作者",
      publisher: "某出版社",
      publishDateText: "2025",
      subtitle: "副标题文字",
      barcode: "000001",
      publishPlace: "",
    },
  ],
  pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
};

describe("BooksPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/books") return Promise.resolve({ data: booksResponse });
      if (path === "/admin/imports") return Promise.resolve({ data: { batches: [] } });
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("renders page heading and book list", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByRole("heading", { name: "图书与导入" })).toBeInTheDocument();
    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(screen.getByText("某作者")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "默认图书目录" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/resources/default-book-catalog/图书馆7楼流通室数据.xlsx")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入默认目录" })).toBeInTheDocument();
    expect(screen.getByText("Admin Panel")).toBeInTheDocument();
    expect(screen.getByText("Admin Console")).toBeInTheDocument();
    expect(screen.getByText("图书、留言和首页素材都在这里维护。")).toBeInTheDocument();
  });

  test("uses mainline admin shell styling", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    const pageHeading = await screen.findByRole("heading", { name: "图书与导入" });
    expect(pageHeading.closest("header")).toHaveClass("rounded-[2.4rem]");
    expect(pageHeading.closest("header")).toHaveClass("bg-white/80");
    expect(screen.getByRole("navigation").closest("aside")).toHaveClass("text-white");
    expect(screen.getByRole("navigation").closest("aside")?.className).toContain(
      "bg-[linear-gradient"
    );
    expect(screen.getByRole("heading", { name: "馆藏图书" }).closest("section")).toHaveClass(
      "paper-panel"
    );
  });

  test("shows empty state when no batches exist", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    expect(screen.getByText(/暂无导入记录/)).toBeInTheDocument();
  });

  test("clicking a book reveals edit form with pre-filled title", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    await userEvent.setup().click(screen.getByText("漂流书目"));

    expect(screen.getByText("编辑图书")).toBeInTheDocument();
    expect(screen.getByDisplayValue("漂流书目")).toBeInTheDocument();
  });

  test("shows import mode hint text for create_only mode", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    expect(screen.getByText("已存在的 book_id 不会被覆盖。")).toBeInTheDocument();
  });

  test("allows selecting csv, xls, and xlsx catalog files", async () => {
    const { container } = wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    const fileInput = container.querySelector('input[type="file"]');
    expect(fileInput).toHaveAttribute("accept", expect.stringContaining(".csv"));
    expect(fileInput).toHaveAttribute("accept", expect.stringContaining(".xls"));
    expect(fileInput).toHaveAttribute("accept", expect.stringContaining(".xlsx"));
    expect(screen.getByText(/CSV\/XLS\/XLSX/)).toBeInTheDocument();
  });

  test("shows batch list when batches exist", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/admin/books") return Promise.resolve({ data: booksResponse });
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      if (path === "/admin/imports")
        return Promise.resolve({
          data: {
            batches: [
              {
                id: "bt1",
                catalogName: "2025年书目",
                fileName: "books.csv",
                status: "completed",
                successRows: 10,
                failedRows: 0,
                createdAt: "2026-01-01T00:00:00Z",
              },
            ],
          },
        });
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("2025年书目")).toBeInTheDocument();
    expect(screen.getByText(/已完成/)).toBeInTheDocument();
  });

  test("keeps book data visible when default resource metadata is unavailable", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/admin/books") return Promise.resolve({ data: booksResponse });
      if (path === "/admin/imports") return Promise.resolve({ data: { batches: [] } });
      if (path === "/admin/default-resources") {
        return Promise.reject({ response: { data: { message: "默认资源接口不存在" } } });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(screen.queryByText("后台数据加载失败")).not.toBeInTheDocument();
  });
});

describe("StudentRosterPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("shows the default student roster import entry", async () => {
    wrap(<StudentRosterPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByRole("heading", { name: "默认学生名册" })).toBeInTheDocument();
    expect(screen.getByText("/tmp/resources/default-student-roster/2025学年学生信息.xls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入默认名册" })).toBeInTheDocument();
    expect(screen.getByText("必填列：系统号、姓名、所在班级。")).toBeInTheDocument();
  });

  test("imports the default student roster and shows summary", async () => {
    mockPost.mockResolvedValue({
      data: {
        totalRows: 2,
        successRows: 2,
        failedRows: 0,
        failures: [],
        defaultStudentRosterPath: "/tmp/resources/default-student-roster/2025学年学生信息.xls",
      },
    });

    wrap(<StudentRosterPage token={TOKEN} onLogout={NOOP} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "导入默认名册" }));

    expect(mockPost).toHaveBeenCalledWith(
      "/admin/student-roster/import-default",
      {},
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(await screen.findByText("导入完成：共 2 行，全部成功。")).toBeInTheDocument();
  });
});

// ─── ReviewsPage ─────────────────────────────────────────────────────────────

const pendingReview = {
  id: "r1",
  status: "pending",
  displayName: "2025届 王小明",
  originalContent: "这是一条待审核的留言。",
  finalContent: "这是一条待审核的留言。",
  sequenceNumber: null,
  isFeatured: false,
  sensitiveHit: false,
  matchedSensitiveWords: [],
  createdAt: "2026-04-19T08:30:00.000Z",
  groupedBook: {
    title: "漂流书目",
    author: "某作者",
    publisher: "某出版社",
    groupBookCount: 1,
  },
  studentIdentity: {
    systemId: "320250001",
    studentName: "王小明",
    className: "高一（1）班",
    cohort: "2025届",
    idCardSuffix: "1234",
  },
};

const reviewsResponse = {
  reviews: [pendingReview],
  pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
};

describe("ReviewsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPut.mockReset();
    mockGet.mockImplementation(() => Promise.resolve({ data: reviewsResponse }));
  });

  test("shows book title and original content", async () => {
    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByRole("heading", { name: "审核列表" })).toBeInTheDocument();
    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(screen.getByText(/原文：这是一条待审核的留言。/)).toBeInTheDocument();
    expect(screen.getByText(/提交时间：2026/)).toBeInTheDocument();
    expect(mockGet).toHaveBeenCalledWith(
      "/admin/reviews",
      expect.objectContaining({
        params: expect.objectContaining({ status: "pending", page: 1, pageSize: 30 }),
      })
    );
  });

  test("searches and resets review query with book-page style controls", async () => {
    mockGet
      .mockResolvedValueOnce({ data: reviewsResponse })
      .mockResolvedValueOnce({
        data: {
          reviews: [{ ...pendingReview, id: "r2", originalContent: "命中检索的留言", finalContent: "命中检索的留言" }],
          pagination: { page: 1, pageSize: 30, total: 1, totalPages: 1 },
        },
      })
      .mockResolvedValueOnce({ data: reviewsResponse });

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("漂流书目");

    const user = userEvent.setup();
    await user.type(screen.getByLabelText("综合检索"), "李老师");
    await user.click(screen.getByRole("button", { name: "搜索" }));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(
        "/admin/reviews",
        expect.objectContaining({
          params: expect.objectContaining({
            status: "pending",
            q: "李老师",
            page: 1,
            pageSize: 30,
          }),
        })
      )
    );

    await user.click(screen.getByRole("button", { name: "重置" }));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(
        "/admin/reviews",
        expect.objectContaining({
          params: expect.objectContaining({ status: "pending", page: 1, pageSize: 30 }),
        })
      )
    );
    expect(mockGet.mock.calls.at(-1)[1].params).not.toHaveProperty("q");
  });

  test("loads next page of reviews with current search filters", async () => {
    mockGet
      .mockResolvedValueOnce({
        data: {
          reviews: [pendingReview],
          pagination: { page: 1, pageSize: 30, total: 31, totalPages: 2 },
        },
      })
      .mockResolvedValueOnce({
        data: {
          reviews: [{ ...pendingReview, id: "r2", originalContent: "第二页留言", finalContent: "第二页留言" }],
          pagination: { page: 2, pageSize: 30, total: 31, totalPages: 2 },
        },
      });

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("漂流书目");

    await userEvent.setup().click(screen.getByRole("button", { name: "下一页" }));

    await waitFor(() =>
      expect(mockGet).toHaveBeenLastCalledWith(
        "/admin/reviews",
        expect.objectContaining({
          params: expect.objectContaining({ status: "pending", page: 2, pageSize: 30 }),
        })
      )
    );
  });

  test("shows student identity info", async () => {
    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    expect(screen.getByText(/学号：320250001/)).toBeInTheDocument();
    expect(screen.getByText(/姓名：王小明/)).toBeInTheDocument();
    expect(screen.getByText(/届别：2025届/)).toBeInTheDocument();
    expect(screen.getByText(/班级：高一（1）班/)).toBeInTheDocument();
  });

  test("shows teacher identity info", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({
        data: {
          reviews: [
            {
              ...pendingReview,
              displayName: "教师 马伟",
              studentIdentity: null,
              teacherIdentity: { teacherName: "马伟" },
            },
          ],
        },
      })
    );

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    expect(screen.getByText(/公开显示：教师 马伟/)).toBeInTheDocument();
    expect(screen.getByText(/教师姓名：马伟/)).toBeInTheDocument();
    expect(screen.queryByText(/来源：历史旧评语/)).not.toBeInTheDocument();
  });

  test("exports all reviews as csv", async () => {
    const createObjectUrl = vi.fn(() => "blob:reviews");
    const revokeObjectUrl = vi.fn();
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => {});

    globalThis.URL.createObjectURL = createObjectUrl;
    globalThis.URL.revokeObjectURL = revokeObjectUrl;
    mockGet
      .mockResolvedValueOnce({ data: { reviews: [pendingReview] } })
      .mockResolvedValueOnce({ data: "\uFEFFcsv-content" });

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("漂流书目");

    await userEvent.setup().click(screen.getByRole("button", { name: "导出全部 CSV" }));

    expect(mockGet).toHaveBeenLastCalledWith(
      "/admin/reviews/export",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
        responseType: "blob",
      })
    );
    expect(createObjectUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:reviews");
    click.mockRestore();
  });

  test("approve button calls PATCH with action=approve", async () => {
    // First call: initial load returns review; second call (after action): returns empty
    mockGet
      .mockResolvedValueOnce({ data: { reviews: [pendingReview] } })
      .mockResolvedValue({ data: { reviews: [] } });
    mockPatch.mockResolvedValue({ data: {} });

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("漂流书目");

    await userEvent.setup().click(screen.getByRole("button", { name: "通过并公开" }));

    expect(mockPatch).toHaveBeenCalledWith(
      "/admin/reviews/r1",
      expect.objectContaining({ action: "approve" }),
      expect.any(Object)
    );
    expect(await screen.findByText("留言已保存并公开。")).toBeInTheDocument();
  });

  test("hide button calls PATCH with action=hide", async () => {
    mockGet
      .mockResolvedValueOnce({ data: { reviews: [pendingReview] } })
      .mockResolvedValue({ data: { reviews: [] } });
    mockPatch.mockResolvedValue({ data: {} });

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("漂流书目");

    await userEvent.setup().click(screen.getByRole("button", { name: "隐藏不公开" }));

    expect(mockPatch).toHaveBeenCalledWith(
      "/admin/reviews/r1",
      expect.objectContaining({ action: "hide" }),
      expect.any(Object)
    );
    expect(await screen.findByText("留言已隐藏，前台不再显示。")).toBeInTheDocument();
  });

  test("shows sensitive word warning when review hits", async () => {
    const hitReview = {
      ...pendingReview,
      sensitiveHit: true,
      matchedSensitiveWords: ["违禁词A", "违禁词B"],
    };
    mockGet.mockImplementation(() =>
      Promise.resolve({ data: { reviews: [hitReview] } })
    );

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText(/命中敏感词：违禁词A、违禁词B/)).toBeInTheDocument();
  });

  test("shows empty state when no reviews match filter", async () => {
    mockGet.mockImplementation(() =>
      Promise.resolve({ data: { reviews: [] } })
    );

    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("暂无符合条件的留言。")).toBeInTheDocument();
  });
});

describe("FeaturedReviewsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/reviews") {
        return Promise.resolve({
          data: {
            reviews: [
              { ...pendingReview, id: "r1", status: "approved" },
              { ...pendingReview, id: "r2", status: "approved", originalContent: "留言2", finalContent: "留言2" },
              { ...pendingReview, id: "r3", status: "approved", originalContent: "留言3", finalContent: "留言3" },
            ],
          },
        });
      }
      if (path === "/admin/featured-reviews") {
        return Promise.resolve({
          data: {
            reviews: [{ id: "r1" }, { id: "r2" }, { id: "r3" }],
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("does not save fewer than three featured reviews when at least three approved reviews exist", async () => {
    wrap(<FeaturedReviewsPage token={TOKEN} onLogout={NOOP} />);
    await screen.findByText("当前精选");

    const user = userEvent.setup();
    const removeButtons = screen.getAllByRole("button", { name: "移出精选" });
    await user.click(removeButtons[0]);

    await user.click(screen.getByRole("button", { name: "保存顺序" }));

    expect(mockPut).not.toHaveBeenCalled();
    expect(await screen.findByText("至少保留 3 条精选留言。")).toBeInTheDocument();
  });
});

describe("SensitiveWordsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      return Promise.reject(new Error("Sensitive words page should not load word entries"));
    });
  });

  test("shows only the default dictionary import entry", async () => {
    wrap(<SensitiveWordsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByRole("heading", { name: "导入内置词库" })).toBeInTheDocument();
    expect(screen.getByText("默认词库目录")).toBeInTheDocument();
    expect(screen.getByText("/tmp/resources/default-sensitive-words")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "导入内置词库" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "新增敏感词" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "现有词库" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("搜索词条")).not.toBeInTheDocument();
    expect(screen.queryByText("添加词条")).not.toBeInTheDocument();
    expect(screen.queryByText("保存修改")).not.toBeInTheDocument();
    expect(screen.queryByText("删除")).not.toBeInTheDocument();
    expect(screen.queryByText("敏感词库加载失败")).not.toBeInTheDocument();
    expect(screen.queryByText("自动去重，跳过已有词条。")).not.toBeInTheDocument();
    expect(screen.queryByText("词库文件随项目部署。")).not.toBeInTheDocument();
    expect(
      screen.queryByText("默认词库不含政治类、GFW 补充、腾讯/网易大杂包等高误判类别。")
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/中度扩容默认词库/)).not.toBeInTheDocument();
    expect(screen.queryByText(/内置文件：/)).not.toBeInTheDocument();
  });

  test("imports the default dictionary and shows summary", async () => {
    mockPost.mockResolvedValue({
      data: {
        defaultSensitiveWordsDir: "/tmp/default-sensitive-words",
        totalWords: 12,
        importedWords: 5,
        skippedWords: 7,
      },
    });

    wrap(<SensitiveWordsPage token={TOKEN} onLogout={NOOP} />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "导入内置词库" }));

    expect(mockPost).toHaveBeenCalledWith(
      "/admin/sensitive-words/import-defaults",
      {},
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(await screen.findByText("内置词库导入完成：新增 5 条，跳过 7 条。")).toBeInTheDocument();
    expect(screen.getByText("共 12 条，新增 5 条，跳过 7 条")).toBeInTheDocument();
    expect(mockGet).not.toHaveBeenCalledWith("/admin/sensitive-words", expect.anything());
  });
});

describe("AssetsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockGet.mockImplementation((path) => {
      if (path === "/admin/assets") return Promise.resolve({ data: assetsResponse });
      if (path === "/admin/default-resources") {
        return Promise.resolve({ data: defaultResourcesResponse });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
    vi.restoreAllMocks();
  });

  test("shows a delete button for each carousel asset", async () => {
    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("校园轮播 1")).toBeInTheDocument();
    expect(screen.getByText("/tmp/default-site-assets")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除轮播图" })).toBeInTheDocument();
  });

  test("keeps site assets visible when default resource metadata is unavailable", async () => {
    mockGet.mockImplementation((path) => {
      if (path === "/admin/assets") return Promise.resolve({ data: assetsResponse });
      if (path === "/admin/default-resources") {
        return Promise.reject({ response: { data: { message: "默认资源接口不存在" } } });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });

    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("校园轮播 1")).toBeInTheDocument();
    expect(screen.queryByText("素材加载失败")).not.toBeInTheDocument();
  });

  test("deletes a carousel asset and shows success feedback", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDelete.mockResolvedValue({
      data: {
        ...assetsResponse,
        carouselImages: [],
      },
    });

    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);
    const user = userEvent.setup();

    await screen.findByText("校园轮播 1");
    await user.click(screen.getByRole("button", { name: "删除轮播图" }));

    expect(mockDelete).toHaveBeenCalledWith(
      "/admin/assets/carousel/slide-1",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${TOKEN}` }),
      })
    );
    expect(await screen.findByText("轮播图已删除。")).toBeInTheDocument();
    expect(screen.getByText("尚无轮播图，上传后即可显示。")).toBeInTheDocument();
  });

  test("shows a loading label while deleting a carousel asset", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    let resolveDelete;
    mockDelete.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
    );

    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);
    const user = userEvent.setup();

    await screen.findByText("校园轮播 1");
    await user.click(screen.getByRole("button", { name: "删除轮播图" }));

    expect(screen.getByRole("button", { name: "正在删除" })).toBeDisabled();

    resolveDelete({
      data: {
        ...assetsResponse,
        carouselImages: [],
      },
    });

    expect(await screen.findByText("轮播图已删除。")).toBeInTheDocument();
  });

  test("shows api errors when deleting a carousel asset fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockDelete.mockRejectedValue({
      response: { data: { message: "轮播图不存在" } },
    });

    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);
    const user = userEvent.setup();

    await screen.findByText("校园轮播 1");
    await user.click(screen.getByRole("button", { name: "删除轮播图" }));

    expect(await screen.findByText("轮播图不存在")).toBeInTheDocument();
  });
});
