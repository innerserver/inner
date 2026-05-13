using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Windows.Forms;

namespace InnerDesktop
{
    internal static class Program
    {
        [STAThread]
        private static void Main()
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new InnerLauncherForm());
        }
    }

    internal sealed class InnerLauncherForm : Form
    {
        private readonly string appRoot;
        private readonly string serverFile;
        private readonly int port = 3000;
        private Process serverProcess;
        private readonly Timer statusTimer = new Timer();

        private readonly Label status = new Label();
        private readonly Button startButton = new Button();
        private readonly Button stopButton = new Button();
        private readonly Button openButton = new Button();
        private readonly Button dataButton = new Button();
        private readonly TextBox urlBox = new TextBox();
        private readonly TextBox shareBox = new TextBox();

        public InnerLauncherForm()
        {
            appRoot = FindAppRoot();
            serverFile = Path.Combine(appRoot, "server.js");
            Directory.SetCurrentDirectory(appRoot);

            Text = "Inner";
            StartPosition = FormStartPosition.CenterScreen;
            MinimumSize = new Size(560, 380);
            Size = new Size(620, 410);
            BackColor = Color.FromArgb(247, 247, 244);
            Font = new Font("Segoe UI", 10F);

            BuildUi();
            HookEvents();

            statusTimer.Interval = 1000;
            statusTimer.Tick += delegate { RefreshStatus(); };
            statusTimer.Start();

            Shown += delegate
            {
                StartServer();
                if (WaitForServerReady(TimeSpan.FromSeconds(15)))
                {
                    OpenInner();
                }
                else
                {
                    RefreshStatus();
                    MessageBox.Show(this, "Inner started slowly or could not answer yet. Press Start, then Open once the status says running.", "Inner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                }
            };
        }

        private string Url
        {
            get { return "http://127.0.0.1:" + port; }
        }

        private string ShareUrl
        {
            get
            {
                string address = GetLocalAddress();
                return String.IsNullOrEmpty(address) ? "No Wi-Fi/LAN address found" : "http://" + address + ":" + port;
            }
        }

        private void BuildUi()
        {
            Label title = new Label();
            title.Text = "Inner";
            title.AutoSize = true;
            title.Font = new Font("Segoe UI", 20F, FontStyle.Bold);
            title.Location = new Point(24, 20);

            Label subtitle = new Label();
            subtitle.Text = "Private workspace server and browser app";
            subtitle.AutoSize = true;
            subtitle.ForeColor = Color.FromArgb(100, 100, 96);
            subtitle.Location = new Point(27, 62);

            status.AutoSize = true;
            status.Location = new Point(27, 102);
            status.Text = "Status: checking";

            Label localLabel = new Label();
            localLabel.Text = "This laptop";
            localLabel.AutoSize = true;
            localLabel.ForeColor = Color.FromArgb(100, 100, 96);
            localLabel.Location = new Point(28, 124);

            urlBox.Location = new Point(28, 146);
            urlBox.Width = 540;
            urlBox.ReadOnly = true;
            urlBox.BorderStyle = BorderStyle.FixedSingle;
            urlBox.Text = Url;

            Label shareLabel = new Label();
            shareLabel.Text = "Other laptops on the same Wi-Fi";
            shareLabel.AutoSize = true;
            shareLabel.ForeColor = Color.FromArgb(100, 100, 96);
            shareLabel.Location = new Point(28, 178);

            shareBox.Location = new Point(28, 200);
            shareBox.Width = 540;
            shareBox.ReadOnly = true;
            shareBox.BorderStyle = BorderStyle.FixedSingle;
            shareBox.Text = ShareUrl;

            startButton.Text = "Start";
            startButton.Location = new Point(28, 244);
            startButton.Size = new Size(96, 38);

            stopButton.Text = "Stop";
            stopButton.Location = new Point(136, 244);
            stopButton.Size = new Size(96, 38);

            openButton.Text = "Open";
            openButton.Location = new Point(244, 244);
            openButton.Size = new Size(96, 38);

            dataButton.Text = "Data";
            dataButton.Location = new Point(352, 244);
            dataButton.Size = new Size(96, 38);

            Label note = new Label();
            note.Text = "Data is saved in the data folder beside the app. Keep this window open while other laptops use Inner.";
            note.ForeColor = Color.FromArgb(100, 100, 96);
            note.Location = new Point(28, 310);
            note.Size = new Size(540, 42);

            Controls.AddRange(new Control[] { title, subtitle, status, localLabel, urlBox, shareLabel, shareBox, startButton, stopButton, openButton, dataButton, note });
        }

        private void HookEvents()
        {
            startButton.Click += delegate { StartServer(); };
            stopButton.Click += delegate { StopServer(); };
            openButton.Click += delegate { OpenInner(); };
            dataButton.Click += delegate { OpenDataFolder(); };
            FormClosing += delegate { StopServer(); };
        }

        private void StartServer()
        {
            if (!File.Exists(serverFile))
            {
                MessageBox.Show(this, "Could not find the Inner server files.\n\nExpected:\n" + serverFile + "\n\nExtract the whole Inner-App.zip first, then run Inner.exe from the extracted folder. Keep server.js, node.exe, and the public folder beside Inner.exe.", "Inner", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return;
            }

            if (IsHealthReady())
            {
                RefreshStatus();
                return;
            }

            if (IsPortOpen())
            {
                RefreshStatus();
                MessageBox.Show(this, "Port " + port + " is already in use, but it does not look like Inner. Close the other app or change Inner's port.", "Inner", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return;
            }

            string node = FindNode();

            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = node;
            startInfo.Arguments = "server.js";
            startInfo.WorkingDirectory = appRoot;
            startInfo.UseShellExecute = false;
            startInfo.CreateNoWindow = true;

            try
            {
                serverProcess = Process.Start(startInfo);
            }
            catch (Exception error)
            {
                MessageBox.Show(this, "Could not start Node.js.\n\nInstall Node.js or put node.exe next to Inner.exe.\n\n" + error.Message, "Inner", MessageBoxButtons.OK, MessageBoxIcon.Error);
            }

            status.Text = "Status: starting";
            startButton.Enabled = false;
            stopButton.Enabled = true;
            openButton.Enabled = false;
        }

        private void StopServer()
        {
            try
            {
                if (serverProcess != null && !serverProcess.HasExited)
                {
                    serverProcess.Kill();
                    serverProcess.WaitForExit(2000);
                }
            }
            catch
            {
                // The server may already be stopped or owned by another launcher.
            }
            finally
            {
                serverProcess = null;
                RefreshStatus();
            }
        }

        private void OpenInner()
        {
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = Url;
            startInfo.UseShellExecute = true;
            Process.Start(startInfo);
        }

        private void OpenDataFolder()
        {
            string dataDir = Path.Combine(appRoot, "data");
            Directory.CreateDirectory(dataDir);
            ProcessStartInfo startInfo = new ProcessStartInfo();
            startInfo.FileName = dataDir;
            startInfo.UseShellExecute = true;
            Process.Start(startInfo);
        }

        private void RefreshStatus()
        {
            bool running = IsHealthReady();
            status.Text = running ? "Status: running at " + Url : "Status: stopped";
            shareBox.Text = ShareUrl;
            startButton.Enabled = !running;
            stopButton.Enabled = running;
            openButton.Enabled = running;
        }

        private bool WaitForServerReady(TimeSpan timeout)
        {
            Stopwatch stopwatch = Stopwatch.StartNew();
            while (stopwatch.Elapsed < timeout)
            {
                if (IsHealthReady())
                {
                    RefreshStatus();
                    return true;
                }

                status.Text = "Status: starting";
                Application.DoEvents();
                System.Threading.Thread.Sleep(150);
            }

            return false;
        }

        private bool IsPortOpen()
        {
            try
            {
                using (TcpClient client = new TcpClient())
                {
                    IAsyncResult result = client.BeginConnect(IPAddress.Loopback, port, null, null);
                    bool connected = result.AsyncWaitHandle.WaitOne(TimeSpan.FromMilliseconds(150));
                    if (!connected) return false;
                    client.EndConnect(result);
                    return true;
                }
            }
            catch
            {
                return false;
            }
        }

        private bool IsHealthReady()
        {
            try
            {
                HttpWebRequest request = (HttpWebRequest)WebRequest.Create(Url + "/api/health");
                request.Method = "GET";
                request.Timeout = 800;
                request.ReadWriteTimeout = 800;
                request.CachePolicy = new System.Net.Cache.RequestCachePolicy(System.Net.Cache.RequestCacheLevel.NoCacheNoStore);
                using (HttpWebResponse response = (HttpWebResponse)request.GetResponse())
                {
                    return response.StatusCode == HttpStatusCode.OK;
                }
            }
            catch
            {
                return false;
            }
        }

        private static string FindAppRoot()
        {
            string[] starts = new string[]
            {
                Path.GetDirectoryName(Application.ExecutablePath),
                AppDomain.CurrentDomain.BaseDirectory,
                Directory.GetCurrentDirectory()
            };

            foreach (string start in starts)
            {
                if (String.IsNullOrEmpty(start)) continue;
                string current = Path.GetFullPath(start);
                for (int i = 0; i < 8; i++)
                {
                    if (File.Exists(Path.Combine(current, "server.js"))) return current;
                    DirectoryInfo parent = Directory.GetParent(current);
                    if (parent == null) break;
                    current = parent.FullName;
                }
            }

            return Path.GetDirectoryName(Application.ExecutablePath) ?? AppDomain.CurrentDomain.BaseDirectory;
        }

        private string FindNode()
        {
            string besideExe = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "node.exe");
            if (File.Exists(besideExe)) return besideExe;

            string besideApp = Path.Combine(appRoot, "node.exe");
            if (File.Exists(besideApp)) return besideApp;

            return "node";
        }

        private static string GetLocalAddress()
        {
            try
            {
                IPAddress[] addresses = Dns.GetHostEntry(Dns.GetHostName()).AddressList;
                foreach (IPAddress address in addresses)
                {
                    if (address.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(address))
                    {
                        return address.ToString();
                    }
                }
            }
            catch
            {
                // Network information can be unavailable on first startup.
            }

            return "";
        }
    }
}
