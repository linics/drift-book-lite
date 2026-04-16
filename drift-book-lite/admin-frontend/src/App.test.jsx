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
    await user.type(await screen.findByLabelText("当前密码"), "change-this-password");
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
    await user.type(await screen.findByLabelText("当前密码"), "change-this-password");
    await user.type(screen.getByLabelText("新密码"), "new-admin-password");
    await user.type(screen.getByLabelText("确认新密码"), "new-admin-password");
    await user.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith(
        "/admin/me/password",
        {
          currentPassword: "change-this-password",
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
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("renders page heading and book list", async () => {
    wrap(<BooksPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(screen.getByText("某作者")).toBeInTheDocument();
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
    expect(screen.getByText(/若 book_id 已存在，该行会失败/)).toBeInTheDocument();
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

describe("ReviewsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
    mockPut.mockReset();
    mockGet.mockImplementation(() =>
      Promise.resolve({ data: { reviews: [pendingReview] } })
    );
  });

  test("shows book title and original content", async () => {
    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("漂流书目")).toBeInTheDocument();
    expect(screen.getByText(/原文：这是一条待审核的留言。/)).toBeInTheDocument();
  });

  test("shows student identity info", async () => {
    wrap(<ReviewsPage token={TOKEN} onLogout={NOOP} />);

    await screen.findByText("漂流书目");
    expect(screen.getByText(/学号：320250001/)).toBeInTheDocument();
    expect(screen.getByText(/姓名：王小明/)).toBeInTheDocument();
    expect(screen.getByText(/届别：2025届/)).toBeInTheDocument();
    expect(screen.getByText(/班级：高一（1）班/)).toBeInTheDocument();
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
      if (path === "/admin/sensitive-words") {
        return Promise.resolve({
          data: {
            words: [{ id: "w1", word: "禁词" }],
            pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
          },
        });
      }
      return Promise.reject(new Error(`Unexpected GET: ${path}`));
    });
  });

  test("shows concise default dictionary copy without source file listing", async () => {
    wrap(<SensitiveWordsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByRole("heading", { name: "导入内置词库" })).toBeInTheDocument();
    expect(screen.getByText("内置 7 类默认词库，导入时会自动去重并跳过已有词条。")).toBeInTheDocument();
    expect(screen.getByText("默认词库目录")).toBeInTheDocument();
    expect(screen.getByText("词库文件随项目部署。")).toBeInTheDocument();
    expect(screen.getByText("默认词库不含政治类、GFW 补充、腾讯/网易大杂包等高误判类别。")).toBeInTheDocument();
    expect(screen.queryByText(/中度扩容默认词库/)).not.toBeInTheDocument();
    expect(screen.queryByText(/内置文件：/)).not.toBeInTheDocument();
  });
});

describe("AssetsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockDelete.mockReset();
    mockGet.mockResolvedValue({ data: assetsResponse });
    vi.restoreAllMocks();
  });

  test("shows a delete button for each carousel asset", async () => {
    wrap(<AssetsPage token={TOKEN} onLogout={NOOP} />);

    expect(await screen.findByText("校园轮播 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "删除轮播图" })).toBeInTheDocument();
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
