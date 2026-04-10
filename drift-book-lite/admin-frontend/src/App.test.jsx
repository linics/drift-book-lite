import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

const { mockGet, mockPost, mockPatch } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("axios", () => ({
  default: {
    create: () => ({
      get: mockGet,
      post: mockPost,
      patch: mockPatch,
      put: vi.fn(),
      delete: vi.fn(),
    }),
  },
}));

// Import pages directly to avoid localStorage / AdminGuard complexity
import { AdminLoginPage } from "./pages/AdminLoginPage.jsx";
import { BooksPage } from "./pages/BooksPage.jsx";
import { ReviewsPage } from "./pages/ReviewsPage.jsx";

const TOKEN = "test-token";
const NOOP = vi.fn();

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
  displayName: "高一（1）班 王*",
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
    idCardSuffix: "1234",
  },
};

describe("ReviewsPage", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPatch.mockReset();
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
    expect(screen.getByText(/班级：高一（1）班/)).toBeInTheDocument();
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
